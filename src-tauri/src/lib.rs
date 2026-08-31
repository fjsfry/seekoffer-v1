use std::collections::VecDeque;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_updater::{Update, UpdaterExt};

mod mentor_photo;

const MAX_PENDING_TRAY_COMMANDS: usize = 32;
const DESKTOP_UPDATER_PROGRESS_EVENT: &str = "seekoffer-updater-progress";
const TRAY_COMMAND_CHECK_UPDATE: &str = "check-update";
const DESKTOP_UPDATE_CHECK_TIMEOUT: Duration = Duration::from_secs(20);
const DESKTOP_UPDATE_DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(10 * 60);

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
enum DesktopUpdatePhase {
    #[default]
    Idle,
    Checking,
    UpToDate,
    Available,
    Downloading,
    ReadyToInstall,
    Installing,
    Error,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateSnapshot {
    version: Option<String>,
    current_version: String,
    notes: Option<String>,
    published_at: Option<String>,
    phase: DesktopUpdatePhase,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<f64>,
    error_code: Option<String>,
    error_message: Option<String>,
    retryable: bool,
    last_checked_at: Option<u64>,
}

impl Default for DesktopUpdateSnapshot {
    fn default() -> Self {
        Self {
            version: None,
            current_version: env!("CARGO_PKG_VERSION").to_owned(),
            notes: None,
            published_at: None,
            phase: DesktopUpdatePhase::Idle,
            downloaded_bytes: 0,
            total_bytes: None,
            percent: None,
            error_code: None,
            error_message: None,
            retryable: false,
            last_checked_at: None,
        }
    }
}

struct DesktopUpdaterInner {
    snapshot: DesktopUpdateSnapshot,
    pending_update: Option<Update>,
    downloaded_bytes: Option<Vec<u8>>,
}

impl Default for DesktopUpdaterInner {
    fn default() -> Self {
        Self {
            snapshot: DesktopUpdateSnapshot::default(),
            pending_update: None,
            downloaded_bytes: None,
        }
    }
}

#[derive(Default)]
struct DesktopUpdaterState {
    inner: Mutex<DesktopUpdaterInner>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateCommandError {
    code: String,
    message: String,
    retryable: bool,
}

impl DesktopUpdateCommandError {
    fn new(code: &str, message: &str, retryable: bool) -> Self {
        Self {
            code: code.to_owned(),
            message: message.to_owned(),
            retryable,
        }
    }

    fn busy() -> Self {
        Self::new("UPDATE_BUSY", "正在执行另一项更新操作，请稍候。", true)
    }

    fn no_update() -> Self {
        Self::new(
            "UPDATE_NOT_AVAILABLE",
            "当前没有可下载的更新，请先检查更新。",
            false,
        )
    }

    fn not_downloaded() -> Self {
        Self::new(
            "UPDATE_NOT_DOWNLOADED",
            "更新尚未下载完成，请先完成下载。",
            false,
        )
    }
}

#[derive(Clone, Copy, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
enum DesktopUpdateProgressKind {
    Started,
    Progress,
    Finished,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopUpdateProgressEvent {
    event: DesktopUpdateProgressKind,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    percent: Option<f64>,
}

fn updater_state_lock(
    state: &DesktopUpdaterState,
) -> std::sync::MutexGuard<'_, DesktopUpdaterInner> {
    state
        .inner
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn now_unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn is_update_operation_active(phase: DesktopUpdatePhase) -> bool {
    matches!(
        phase,
        DesktopUpdatePhase::Checking
            | DesktopUpdatePhase::Downloading
            | DesktopUpdatePhase::Installing
    )
}

fn should_reuse_cached_update(
    manual: bool,
    phase: DesktopUpdatePhase,
    has_pending_update: bool,
    has_downloaded_bytes: bool,
) -> bool {
    if manual || !has_pending_update {
        return false;
    }

    match phase {
        DesktopUpdatePhase::Available => true,
        DesktopUpdatePhase::ReadyToInstall => has_downloaded_bytes,
        _ => false,
    }
}

fn download_percent(downloaded_bytes: u64, total_bytes: Option<u64>) -> Option<f64> {
    let total_bytes = total_bytes.filter(|total| *total > 0)?;
    let percent = downloaded_bytes as f64 / total_bytes as f64 * 100.0;
    Some((percent.clamp(0.0, 100.0) * 10.0).round() / 10.0)
}

fn clear_update_error(snapshot: &mut DesktopUpdateSnapshot) {
    snapshot.error_code = None;
    snapshot.error_message = None;
    snapshot.retryable = false;
}

fn mark_desktop_up_to_date(inner: &mut DesktopUpdaterInner, checked_at: u64) {
    inner.snapshot.version = None;
    inner.snapshot.notes = None;
    inner.snapshot.published_at = None;
    inner.snapshot.phase = DesktopUpdatePhase::UpToDate;
    inner.snapshot.last_checked_at = Some(checked_at);
    inner.snapshot.downloaded_bytes = 0;
    inner.snapshot.total_bytes = None;
    inner.snapshot.percent = None;
    clear_update_error(&mut inner.snapshot);
    inner.pending_update = None;
    inner.downloaded_bytes = None;
}

fn set_update_error(
    inner: &mut DesktopUpdaterInner,
    error: &DesktopUpdateCommandError,
) -> DesktopUpdateSnapshot {
    inner.snapshot.phase = DesktopUpdatePhase::Error;
    inner.snapshot.error_code = Some(error.code.clone());
    inner.snapshot.error_message = Some(error.message.clone());
    inner.snapshot.retryable = error.retryable;
    inner.snapshot.clone()
}

fn map_updater_error(error: &tauri_plugin_updater::Error) -> DesktopUpdateCommandError {
    use tauri_plugin_updater::Error;

    match error {
        Error::EmptyEndpoints | Error::InsecureTransportProtocol => DesktopUpdateCommandError::new(
            "UPDATE_CONFIGURATION_ERROR",
            "更新服务尚未正确配置，请稍后再试。",
            false,
        ),
        Error::ReleaseNotFound | Error::Reqwest(_) | Error::Network(_) => {
            DesktopUpdateCommandError::new(
                "UPDATE_NETWORK_ERROR",
                "暂时无法连接更新服务，请检查网络后重试。",
                true,
            )
        }
        Error::TargetNotFound(_)
        | Error::TargetsNotFound(_)
        | Error::UnsupportedArch
        | Error::UnsupportedOs => DesktopUpdateCommandError::new(
            "UPDATE_UNSUPPORTED",
            "当前设备暂不支持自动更新，请从寻鹿官网下载最新版本。",
            false,
        ),
        Error::Minisign(_)
        | Error::Base64(_)
        | Error::SignatureUtf8(_)
        | Error::InvalidUpdaterFormat => DesktopUpdateCommandError::new(
            "UPDATE_SIGNATURE_ERROR",
            "更新包安全校验未通过，已停止安装。请稍后重试或从官网下载。",
            false,
        ),
        Error::Io(_)
        | Error::FailedToDetermineExtractPath
        | Error::TempDirNotFound
        | Error::TempDirNotOnSameMountPoint
        | Error::BinaryNotFoundInArchive
        | Error::PackageInstallFailed => DesktopUpdateCommandError::new(
            "UPDATE_INSTALL_ERROR",
            "更新包无法在此设备上安装，请稍后重试。",
            true,
        ),
        _ => DesktopUpdateCommandError::new(
            "UPDATE_UNKNOWN_ERROR",
            "检查更新时遇到问题，请稍后重试。",
            true,
        ),
    }
}

fn emit_update_progress(app: &AppHandle, payload: DesktopUpdateProgressEvent) {
    let _ = app.emit(DESKTOP_UPDATER_PROGRESS_EVENT, payload);
}

#[tauri::command]
fn get_desktop_update_snapshot(
    state: tauri::State<'_, DesktopUpdaterState>,
) -> DesktopUpdateSnapshot {
    updater_state_lock(&state).snapshot.clone()
}

#[tauri::command]
async fn check_for_desktop_update(
    app: AppHandle,
    state: tauri::State<'_, DesktopUpdaterState>,
    manual: bool,
) -> Result<DesktopUpdateSnapshot, DesktopUpdateCommandError> {
    {
        let mut inner = updater_state_lock(&state);
        if is_update_operation_active(inner.snapshot.phase) {
            return Err(DesktopUpdateCommandError::busy());
        }
        if should_reuse_cached_update(
            manual,
            inner.snapshot.phase,
            inner.pending_update.is_some(),
            inner.downloaded_bytes.is_some(),
        ) {
            return Ok(inner.snapshot.clone());
        }

        inner.snapshot.phase = DesktopUpdatePhase::Checking;
        clear_update_error(&mut inner.snapshot);
    }

    let updater = match app
        .updater_builder()
        .timeout(DESKTOP_UPDATE_CHECK_TIMEOUT)
        .build()
    {
        Ok(updater) => updater,
        Err(error) => {
            let command_error = map_updater_error(&error);
            let mut inner = updater_state_lock(&state);
            inner.snapshot.last_checked_at = Some(now_unix_millis());
            set_update_error(&mut inner, &command_error);
            return Err(command_error);
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let mut inner = updater_state_lock(&state);
            inner.snapshot.version = Some(update.version.clone());
            inner.snapshot.current_version = update.current_version.clone();
            inner.snapshot.notes = update.body.clone();
            inner.snapshot.published_at = update.date.map(|date| date.to_string());
            inner.snapshot.phase = DesktopUpdatePhase::Available;
            inner.snapshot.last_checked_at = Some(now_unix_millis());
            inner.snapshot.downloaded_bytes = 0;
            inner.snapshot.total_bytes = None;
            inner.snapshot.percent = None;
            clear_update_error(&mut inner.snapshot);
            inner.pending_update = Some(update);
            inner.downloaded_bytes = None;
            Ok(inner.snapshot.clone())
        }
        Ok(None) => {
            let mut inner = updater_state_lock(&state);
            mark_desktop_up_to_date(&mut inner, now_unix_millis());
            Ok(inner.snapshot.clone())
        }
        Err(error) => {
            let command_error = map_updater_error(&error);
            let mut inner = updater_state_lock(&state);
            inner.snapshot.last_checked_at = Some(now_unix_millis());
            set_update_error(&mut inner, &command_error);
            Err(command_error)
        }
    }
}

#[tauri::command]
async fn download_desktop_update(
    app: AppHandle,
    state: tauri::State<'_, DesktopUpdaterState>,
) -> Result<DesktopUpdateSnapshot, DesktopUpdateCommandError> {
    let mut update = {
        let mut inner = updater_state_lock(&state);
        if is_update_operation_active(inner.snapshot.phase) {
            return Err(DesktopUpdateCommandError::busy());
        }
        if inner.snapshot.phase == DesktopUpdatePhase::ReadyToInstall
            && inner.downloaded_bytes.is_some()
        {
            return Ok(inner.snapshot.clone());
        }
        let update = inner
            .pending_update
            .clone()
            .ok_or_else(DesktopUpdateCommandError::no_update)?;

        inner.snapshot.phase = DesktopUpdatePhase::Downloading;
        inner.snapshot.downloaded_bytes = 0;
        inner.snapshot.total_bytes = None;
        inner.snapshot.percent = None;
        inner.downloaded_bytes = None;
        clear_update_error(&mut inner.snapshot);
        update
    };
    update.timeout = Some(DESKTOP_UPDATE_DOWNLOAD_TIMEOUT);

    emit_update_progress(
        &app,
        DesktopUpdateProgressEvent {
            event: DesktopUpdateProgressKind::Started,
            downloaded_bytes: 0,
            total_bytes: None,
            percent: None,
        },
    );

    let mut downloaded_bytes = 0_u64;
    let result = update
        .download(
            |chunk_length, content_length| {
                downloaded_bytes = downloaded_bytes
                    .saturating_add(u64::try_from(chunk_length).unwrap_or(u64::MAX));
                let percent = download_percent(downloaded_bytes, content_length);

                {
                    let mut inner = updater_state_lock(&state);
                    if inner.snapshot.phase == DesktopUpdatePhase::Downloading {
                        inner.snapshot.downloaded_bytes = downloaded_bytes;
                        inner.snapshot.total_bytes = content_length;
                        inner.snapshot.percent = percent;
                    }
                }

                emit_update_progress(
                    &app,
                    DesktopUpdateProgressEvent {
                        event: DesktopUpdateProgressKind::Progress,
                        downloaded_bytes,
                        total_bytes: content_length,
                        percent,
                    },
                );
            },
            || {},
        )
        .await;

    match result {
        Ok(bytes) => {
            let actual_size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
            let mut inner = updater_state_lock(&state);
            inner.snapshot.phase = DesktopUpdatePhase::ReadyToInstall;
            inner.snapshot.downloaded_bytes = actual_size;
            inner.snapshot.total_bytes = Some(actual_size);
            inner.snapshot.percent = Some(100.0);
            clear_update_error(&mut inner.snapshot);
            inner.downloaded_bytes = Some(bytes);
            let snapshot = inner.snapshot.clone();
            drop(inner);

            emit_update_progress(
                &app,
                DesktopUpdateProgressEvent {
                    event: DesktopUpdateProgressKind::Finished,
                    downloaded_bytes: actual_size,
                    total_bytes: Some(actual_size),
                    percent: Some(100.0),
                },
            );
            Ok(snapshot)
        }
        Err(error) => {
            let command_error = map_updater_error(&error);
            let mut inner = updater_state_lock(&state);
            inner.downloaded_bytes = None;
            set_update_error(&mut inner, &command_error);
            Err(command_error)
        }
    }
}

#[tauri::command]
fn install_desktop_update(
    state: tauri::State<'_, DesktopUpdaterState>,
) -> Result<DesktopUpdateSnapshot, DesktopUpdateCommandError> {
    let (update, bytes) = {
        let mut inner = updater_state_lock(&state);
        if is_update_operation_active(inner.snapshot.phase) {
            return Err(DesktopUpdateCommandError::busy());
        }
        let update = inner
            .pending_update
            .take()
            .ok_or_else(DesktopUpdateCommandError::no_update)?;
        let bytes = match inner.downloaded_bytes.take() {
            Some(bytes) => bytes,
            None => {
                inner.pending_update = Some(update);
                return Err(DesktopUpdateCommandError::not_downloaded());
            }
        };
        inner.snapshot.phase = DesktopUpdatePhase::Installing;
        clear_update_error(&mut inner.snapshot);
        (update, bytes)
    };

    // Installation consumes the exact bytes already downloaded and verified by
    // the updater plugin. It intentionally does not make another network request:
    // a manual check is the explicit refresh/revocation path, while installation
    // remains reliable when the network becomes unavailable after the download.
    if let Err(error) = update.install(&bytes) {
        let command_error = map_updater_error(&error);
        let mut inner = updater_state_lock(&state);
        inner.pending_update = Some(update);
        inner.downloaded_bytes = Some(bytes);
        set_update_error(&mut inner, &command_error);
        return Err(command_error);
    }

    // On Windows a successful install exits the process before reaching this line.
    // Keeping the state as `installing` makes the return value correct on other
    // desktop platforms should they be enabled later.
    Ok(updater_state_lock(&state).snapshot.clone())
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TrayCommandPayload {
    id: u64,
    command: String,
}

struct TrayCommandState {
    next_id: AtomicU64,
    pending: Mutex<VecDeque<TrayCommandPayload>>,
}

impl Default for TrayCommandState {
    fn default() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            pending: Mutex::new(VecDeque::new()),
        }
    }
}

impl TrayCommandState {
    fn enqueue(&self, command: &str) -> TrayCommandPayload {
        let payload = TrayCommandPayload {
            id: self.next_id.fetch_add(1, Ordering::Relaxed),
            command: command.to_owned(),
        };
        let mut pending = self
            .pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if pending.len() >= MAX_PENDING_TRAY_COMMANDS {
            pending.pop_front();
        }
        pending.push_back(payload.clone());
        payload
    }

    fn peek(&self) -> Option<TrayCommandPayload> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .front()
            .cloned()
    }

    fn acknowledge(&self, id: u64) -> bool {
        let mut pending = self
            .pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let Some(position) = pending.iter().position(|payload| payload.id == id) else {
            return false;
        };
        pending.remove(position);
        true
    }
}

fn reveal_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }

    if let Some(splashscreen) = app.get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
}

fn show_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

fn queue_tray_command<R: tauri::Runtime>(app: &tauri::AppHandle<R>, command: &str) {
    let state = app.state::<TrayCommandState>();
    let payload = state.enqueue(command);

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit("seekoffer-tray-command", payload);
    }
}

#[tauri::command]
fn take_pending_tray_command(
    state: tauri::State<'_, TrayCommandState>,
) -> Option<TrayCommandPayload> {
    state.peek()
}

#[tauri::command]
fn acknowledge_tray_command(id: u64, state: tauri::State<'_, TrayCommandState>) -> bool {
    state.acknowledge(id)
}

#[tauri::command]
fn desktop_frontend_ready(app: tauri::AppHandle) -> bool {
    reveal_main(&app);
    true
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let window_state_flags = tauri_plugin_window_state::StateFlags::POSITION
        | tauri_plugin_window_state::StateFlags::SIZE
        | tauri_plugin_window_state::StateFlags::MAXIMIZED;

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(window_state_flags)
                .with_denylist(&["splashscreen"])
                .build(),
        )
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(TrayCommandState::default())
        .manage(DesktopUpdaterState::default())
        .manage(mentor_photo::MentorPhotoState::default())
        .invoke_handler(tauri::generate_handler![
            take_pending_tray_command,
            acknowledge_tray_command,
            desktop_frontend_ready,
            get_desktop_update_snapshot,
            check_for_desktop_update,
            download_desktop_update,
            install_desktop_update,
            mentor_photo::resolve_mentor_photo,
            mentor_photo::load_cached_mentor_photo
        ])
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "show-main", "打开寻鹿", true, None::<&str>)?;
            let workbench_item =
                MenuItem::with_id(app, "open-workbench", "全部申请", true, None::<&str>)?;
            let deadline_item =
                MenuItem::with_id(app, "open-deadline", "最近截止", true, None::<&str>)?;
            let materials_item =
                MenuItem::with_id(app, "open-materials", "待补材料", true, None::<&str>)?;
            let unread_item =
                MenuItem::with_id(app, "open-unread", "未读通知", true, None::<&str>)?;
            let contacts_item =
                MenuItem::with_id(app, "open-contacts", "导师联系", true, None::<&str>)?;
            let check_update_item =
                MenuItem::with_id(app, "check-update", "检查更新", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit-app", "退出寻鹿", true, None::<&str>)?;
            let tray_menu = Menu::with_items(
                app,
                &[
                    &open_item,
                    &workbench_item,
                    &deadline_item,
                    &materials_item,
                    &unread_item,
                    &contacts_item,
                    &check_update_item,
                    &quit_item,
                ],
            )?;
            let mut tray = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("寻鹿 SeekOffer");
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, event| match event.id().as_ref() {
                "show-main" => show_main(app),
                "open-workbench" => {
                    show_main(app);
                    queue_tray_command(app, "workbench");
                }
                "open-deadline" => {
                    show_main(app);
                    queue_tray_command(app, "deadline");
                }
                "open-materials" => {
                    show_main(app);
                    queue_tray_command(app, "materials");
                }
                "open-unread" => {
                    show_main(app);
                    queue_tray_command(app, "unread");
                }
                "open-contacts" => {
                    show_main(app);
                    queue_tray_command(app, "contacts");
                }
                "check-update" => {
                    show_main(app);
                    queue_tray_command(app, TRAY_COMMAND_CHECK_UPDATE);
                }
                "quit-app" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main(tray.app_handle());
                }
            })
            .build(app)?;

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(15));
                let fallback_handle = app_handle.clone();
                let _ = app_handle.run_on_main_thread(move || reveal_main(&fallback_handle));
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SeekOffer desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_commands_remain_pending_until_their_id_is_acknowledged() {
        let state = TrayCommandState::default();
        let first = state.enqueue("workbench");
        let second = state.enqueue("materials");

        assert_eq!(state.peek().map(|payload| payload.id), Some(first.id));
        assert!(!state.acknowledge(second.id + 100));
        assert_eq!(state.peek().map(|payload| payload.id), Some(first.id));
        assert!(state.acknowledge(first.id));
        let next = state.peek().expect("second command should remain queued");
        assert_eq!(next.id, second.id);
        assert_eq!(next.command, "materials");
    }

    #[test]
    fn tray_command_queue_is_bounded_and_keeps_the_newest_commands() {
        let state = TrayCommandState::default();
        let first = state.enqueue("oldest");
        for index in 0..MAX_PENDING_TRAY_COMMANDS {
            state.enqueue(&format!("command-{index}"));
        }

        assert_ne!(state.peek().map(|payload| payload.id), Some(first.id));
        assert_eq!(
            state
                .pending
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .len(),
            MAX_PENDING_TRAY_COMMANDS
        );
    }

    #[test]
    fn check_update_tray_command_uses_the_frontend_controller_route() {
        let state = TrayCommandState::default();
        let command = state.enqueue(TRAY_COMMAND_CHECK_UPDATE);

        assert_eq!(command.command, "check-update");
        assert_eq!(
            state.peek().map(|payload| payload.command),
            Some(command.command)
        );
    }

    #[test]
    fn desktop_update_snapshot_uses_the_frontend_contract() {
        let snapshot = DesktopUpdateSnapshot::default();
        let json = serde_json::to_value(snapshot).expect("snapshot should serialize");

        assert_eq!(json["phase"], "idle");
        assert_eq!(json["currentVersion"], env!("CARGO_PKG_VERSION"));
        assert_eq!(json["downloadedBytes"], 0);
        assert!(json.get("lastCheckedAt").is_some());
        assert!(json.get("errorCode").is_some());
    }

    #[test]
    fn download_percentage_is_bounded_and_uses_real_byte_counts() {
        assert_eq!(download_percent(25, Some(100)), Some(25.0));
        assert_eq!(download_percent(1, Some(3)), Some(33.3));
        assert_eq!(download_percent(150, Some(100)), Some(100.0));
        assert_eq!(download_percent(10, Some(0)), None);
        assert_eq!(download_percent(10, None), None);
    }

    #[test]
    fn only_mutating_update_operations_are_single_flight() {
        assert!(is_update_operation_active(DesktopUpdatePhase::Checking));
        assert!(is_update_operation_active(DesktopUpdatePhase::Downloading));
        assert!(is_update_operation_active(DesktopUpdatePhase::Installing));
        assert!(!is_update_operation_active(DesktopUpdatePhase::Available));
        assert!(!is_update_operation_active(
            DesktopUpdatePhase::ReadyToInstall
        ));
    }

    #[test]
    fn manual_checks_always_refresh_while_automatic_checks_can_reuse_cache() {
        assert!(!should_reuse_cached_update(
            true,
            DesktopUpdatePhase::Available,
            true,
            false
        ));
        assert!(!should_reuse_cached_update(
            true,
            DesktopUpdatePhase::ReadyToInstall,
            true,
            true
        ));
        assert!(should_reuse_cached_update(
            false,
            DesktopUpdatePhase::Available,
            true,
            false
        ));
        assert!(should_reuse_cached_update(
            false,
            DesktopUpdatePhase::ReadyToInstall,
            true,
            true
        ));
        assert!(!should_reuse_cached_update(
            false,
            DesktopUpdatePhase::ReadyToInstall,
            true,
            false
        ));
    }

    #[test]
    fn a_no_update_response_revokes_staged_download_metadata_and_bytes() {
        let mut inner = DesktopUpdaterInner::default();
        inner.snapshot.version = Some("9.9.9".to_owned());
        inner.snapshot.notes = Some("撤回前的更新".to_owned());
        inner.snapshot.published_at = Some("2026-08-10T10:00:00Z".to_owned());
        inner.snapshot.phase = DesktopUpdatePhase::ReadyToInstall;
        inner.snapshot.downloaded_bytes = 3;
        inner.snapshot.total_bytes = Some(3);
        inner.snapshot.percent = Some(100.0);
        inner.downloaded_bytes = Some(vec![1, 2, 3]);

        mark_desktop_up_to_date(&mut inner, 1234);

        assert_eq!(inner.snapshot.phase, DesktopUpdatePhase::UpToDate);
        assert_eq!(inner.snapshot.last_checked_at, Some(1234));
        assert!(inner.snapshot.version.is_none());
        assert!(inner.snapshot.notes.is_none());
        assert!(inner.snapshot.published_at.is_none());
        assert_eq!(inner.snapshot.downloaded_bytes, 0);
        assert!(inner.snapshot.total_bytes.is_none());
        assert!(inner.snapshot.percent.is_none());
        assert!(inner.pending_update.is_none());
        assert!(inner.downloaded_bytes.is_none());
    }

    #[test]
    fn updater_network_operations_have_bounded_timeouts() {
        assert_eq!(DESKTOP_UPDATE_CHECK_TIMEOUT, Duration::from_secs(20));
        assert_eq!(
            DESKTOP_UPDATE_DOWNLOAD_TIMEOUT,
            Duration::from_secs(10 * 60)
        );
        assert!(DESKTOP_UPDATE_DOWNLOAD_TIMEOUT > DESKTOP_UPDATE_CHECK_TIMEOUT);
    }

    #[test]
    fn updater_failures_are_mapped_to_stable_user_facing_codes() {
        let configuration = map_updater_error(&tauri_plugin_updater::Error::EmptyEndpoints);
        assert_eq!(configuration.code, "UPDATE_CONFIGURATION_ERROR");
        assert!(!configuration.retryable);

        let network = map_updater_error(&tauri_plugin_updater::Error::Network(
            "server unavailable".to_owned(),
        ));
        assert_eq!(network.code, "UPDATE_NETWORK_ERROR");
        assert!(network.retryable);
        assert!(!network.message.contains("server unavailable"));
    }

    #[test]
    fn failed_update_is_visible_in_the_latest_snapshot() {
        let mut inner = DesktopUpdaterInner::default();
        let error = DesktopUpdateCommandError::new(
            "UPDATE_NETWORK_ERROR",
            "暂时无法连接更新服务，请检查网络后重试。",
            true,
        );

        let snapshot = set_update_error(&mut inner, &error);

        assert_eq!(snapshot.phase, DesktopUpdatePhase::Error);
        assert_eq!(snapshot.error_code.as_deref(), Some("UPDATE_NETWORK_ERROR"));
        assert_eq!(
            snapshot.error_message.as_deref(),
            Some(error.message.as_str())
        );
        assert!(snapshot.retryable);
    }
}
