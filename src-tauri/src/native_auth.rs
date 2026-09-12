//! Clerk public-client PKCE. Persistent credentials are Windows CurrentUser DPAPI.
//! Only authorization code/state travel through the loopback URL, never tokens.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const ISSUER: &str = "https://clerk.seekoffer.com.cn";
const CLIENT_ID: &str = "bXDBbWjJFxXqoeG3";
const FILE: &str = "clerk-native-session-v1.dpapi";

#[tauri::command]
pub async fn native_public_request(
    window: tauri::WebviewWindow,
    path: String,
    method: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    require_main(&window)?;
    if path.len() > 4096
        || path.contains('#')
        || path.contains("..")
        || !matches!(method.as_str(), "GET" | "POST")
    {
        return Err(error("PUBLIC_ROUTE_REJECTED"));
    }
    let endpoint = path.split('?').next().unwrap_or("").trim_end_matches('/');
    let base = match (endpoint, method.as_str()) {
        ("/api/public/notices", "GET")
        | ("/api/public/notices/metadata", "GET")
        | ("/api/public/notices/deadlines", "GET")
        | ("/api/public/notices/by-ids", "POST") => "https://www.seekoffer.com.cn",
        ("/v1/public/notice-detail", "GET") => "https://migration.seekoffer.com.cn",
        _ => return Err(error("PUBLIC_ROUTE_REJECTED")),
    };
    let data = body.map(|b| b.to_string()).unwrap_or_default();
    if data.len() > 32768 {
        return Err(error("PUBLIC_PAYLOAD_TOO_LARGE"));
    }
    let mut request = http()?
        .request(
            if method == "GET" {
                reqwest::Method::GET
            } else {
                reqwest::Method::POST
            },
            format!("{base}{path}"),
        )
        .header("Accept", "application/json");
    if method == "POST" {
        request = request
            .header("Content-Type", "application/json")
            .body(data);
    }
    let response = request.send().await.map_err(|e| {
        error(if e.is_timeout() {
            "PUBLIC_REQUEST_TIMEOUT"
        } else {
            "PUBLIC_NETWORK_UNAVAILABLE"
        })
    })?;
    if response.status().as_u16() == 404 && endpoint == "/v1/public/notice-detail" {
        return Ok(serde_json::Value::Null);
    }
    match response.status().as_u16() {
        400 => return Err(error("PUBLIC_REQUEST_INVALID")),
        401 => return Err(error("PUBLIC_AUTH_REQUIRED")),
        402 => return Err(error("PUBLIC_QUOTA_RESTRICTED")),
        403 => return Err(error("PUBLIC_ACCESS_DENIED")),
        404 => return Err(error("PUBLIC_ROUTE_UNAVAILABLE")),
        409 => return Err(error("PUBLIC_VERSION_CHANGED")),
        429 => return Err(error("PUBLIC_RATE_LIMITED")),
        status if status >= 500 => return Err(error("PUBLIC_SERVICE_UNAVAILABLE")),
        _ => {}
    }
    json(response).await
}

#[derive(Default)]
pub struct NativeAuthState {
    session: tokio::sync::Mutex<Option<StoredSession>>,
    busy: AtomicBool,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StoredSession {
    access_token: String,
    refresh_token: String,
    expires_at: u64,
    subject: String,
    email: String,
    session_id: String,
    established_at: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSession {
    access_token: String,
    expires_at: u64,
    subject: String,
    email: String,
    session_id: String,
}
impl From<&StoredSession> for BrowserSession {
    fn from(s: &StoredSession) -> Self {
        Self {
            access_token: s.access_token.clone(),
            expires_at: s.expires_at,
            subject: s.subject.clone(),
            email: s.email.clone(),
            session_id: s.session_id.clone(),
        }
    }
}
fn require_main(window: &tauri::WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|_| error("NATIVE_WINDOW_REJECTED"))?;
    if window.label() != "main"
        || !((url.scheme() == "tauri" && url.host_str() == Some("localhost"))
            || (url.scheme() == "http" && url.host_str() == Some("tauri.localhost")))
    {
        return Err(error("NATIVE_WINDOW_REJECTED"));
    }
    Ok(())
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn error(s: &str) -> String {
    s.to_string()
}
fn file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
    std::fs::create_dir_all(&dir).map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
    Ok(dir.join(FILE))
}
#[cfg(windows)]
mod windows {
    use super::*;
    #[repr(C)]
    struct Blob {
        size: u32,
        data: *mut u8,
    }
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            input: *const Blob,
            description: *const u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const Blob,
            description: *mut *mut u16,
            entropy: *const Blob,
            reserved: *mut std::ffi::c_void,
            prompt: *mut std::ffi::c_void,
            flags: u32,
            output: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(p: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    }
    #[link(name = "bcrypt")]
    extern "system" {
        fn BCryptGenRandom(
            handle: *mut std::ffi::c_void,
            buffer: *mut u8,
            length: u32,
            flags: u32,
        ) -> i32;
    }
    pub fn random() -> Result<String, String> {
        let mut b = [0u8; 32];
        if unsafe { BCryptGenRandom(std::ptr::null_mut(), b.as_mut_ptr(), 32, 2) } != 0 {
            return Err(error("NATIVE_RANDOM_FAILED"));
        }
        Ok(URL_SAFE_NO_PAD.encode(b))
    }
    pub fn crypt(input: &[u8], protect: bool) -> Result<Vec<u8>, String> {
        if input.len() > 65536 {
            return Err(error("NATIVE_CREDENTIAL_SIZE"));
        }
        let b = Blob {
            size: input.len() as u32,
            data: input.as_ptr() as *mut u8,
        };
        let salt = b"seekoffer-clerk-native-v1";
        let entropy = Blob {
            size: salt.len() as u32,
            data: salt.as_ptr() as *mut u8,
        };
        let mut out = Blob {
            size: 0,
            data: std::ptr::null_mut(),
        };
        let ok = unsafe {
            if protect {
                CryptProtectData(
                    &b,
                    std::ptr::null(),
                    &entropy,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    1,
                    &mut out,
                )
            } else {
                CryptUnprotectData(
                    &b,
                    std::ptr::null_mut(),
                    &entropy,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    1,
                    &mut out,
                )
            }
        };
        if ok == 0 {
            return Err(error("NATIVE_DPAPI_FAILED"));
        }
        let value = unsafe { std::slice::from_raw_parts(out.data, out.size as usize).to_vec() };
        unsafe {
            std::ptr::write_bytes(out.data, 0, out.size as usize);
            LocalFree(out.data.cast());
        }
        Ok(value)
    }
}
#[cfg(not(windows))]
mod windows {
    pub fn random() -> Result<String, String> {
        Err("WINDOWS_REQUIRED".into())
    }
    pub fn crypt(_: &[u8], _: bool) -> Result<Vec<u8>, String> {
        Err("WINDOWS_REQUIRED".into())
    }
}
fn save(app: &AppHandle, s: &StoredSession) -> Result<(), String> {
    let raw = serde_json::to_vec(s).map_err(|_| error("NATIVE_SERIALIZATION_FAILED"))?;
    let encrypted = windows::crypt(&raw, true)?;
    let path = file(app)?;
    let temp = path.with_extension("next.dpapi");
    {
        use std::io::Write;
        let mut f =
            std::fs::File::create(&temp).map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
        f.write_all(&encrypted)
            .and_then(|_| f.sync_all())
            .map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
    }
    std::fs::rename(temp, path).map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))
}
fn load(app: &AppHandle) -> Result<Option<StoredSession>, String> {
    let p = file(app)?;
    if !p.exists() {
        return Ok(None);
    }
    let encrypted = std::fs::read(p).map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
    let plain = windows::crypt(&encrypted, false)?;
    let s: StoredSession =
        serde_json::from_slice(&plain).map_err(|_| error("NATIVE_CREDENTIAL_INVALID"))?;
    if !s.subject.starts_with("user_")
        || s.access_token.len() > 16000
        || s.refresh_token.len() > 16000
    {
        return Err(error("NATIVE_CREDENTIAL_INVALID"));
    }
    Ok(Some(s))
}
fn http() -> Result<reqwest::Client, String> {
    // Clone shares the connection pool across list/metadata and token requests.
    // Certificate and hostname verification remain enabled.
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(5))
                .timeout(Duration::from_secs(15))
                .build()
                .map_err(|_| error("NATIVE_TLS_CONFIGURATION"))
        })
        .clone()
}
async fn json(response: reqwest::Response) -> Result<serde_json::Value, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(error(if status.as_u16() == 400 || status.as_u16() == 401 {
            "NATIVE_LOGIN_EXPIRED"
        } else {
            "NATIVE_AUTH_UNAVAILABLE"
        }));
    }
    let mut r = response;
    let mut bytes = Vec::new();
    while let Some(part) = r
        .chunk()
        .await
        .map_err(|_| error("NATIVE_AUTH_UNAVAILABLE"))?
    {
        if bytes.len() + part.len() > 131072 {
            return Err(error("NATIVE_RESPONSE_TOO_LARGE"));
        }
        bytes.extend_from_slice(&part);
    }
    serde_json::from_slice(&bytes).map_err(|_| error("NATIVE_RESPONSE_INVALID"))
}
fn form(values: &[(&str, &str)]) -> String {
    let mut encoded = url::form_urlencoded::Serializer::new(String::new());
    for (k, v) in values {
        encoded.append_pair(k, v);
    }
    encoded.finish()
}
async fn exchange(values: &[(&str, &str)]) -> Result<serde_json::Value, String> {
    json(
        http()?
            .post(format!("{ISSUER}/oauth/token"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form(values))
            .send()
            .await
            .map_err(|_| error("NATIVE_AUTH_UNAVAILABLE"))?,
    )
    .await
}
fn tokens(value: &serde_json::Value) -> Result<(String, String, u64), String> {
    let access = value["access_token"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 16000)
        .ok_or_else(|| error("NATIVE_TOKEN_INVALID"))?;
    let refresh = value["refresh_token"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() <= 16000)
        .ok_or_else(|| error("NATIVE_REFRESH_UNAVAILABLE"))?;
    let seconds = value["expires_in"]
        .as_u64()
        .filter(|n| *n > 0 && *n <= 90000)
        .ok_or_else(|| error("NATIVE_EXPIRY_INVALID"))?;
    if !value["token_type"]
        .as_str()
        .is_some_and(|s| s.eq_ignore_ascii_case("bearer"))
    {
        return Err(error("NATIVE_TOKEN_INVALID"));
    }
    Ok((access.into(), refresh.into(), now() + seconds))
}
fn callback(target: &str, state: &str, port: u16) -> Result<String, String> {
    if !target.starts_with('/') || target.len() > 4096 {
        return Err(error("NATIVE_CALLBACK_INVALID"));
    }
    let url = url::Url::parse(&format!("http://127.0.0.1:{port}{target}"))
        .map_err(|_| error("NATIVE_CALLBACK_INVALID"))?;
    if url.path() != "/callback" {
        return Err(error("NATIVE_CALLBACK_INVALID"));
    }
    let query: Vec<_> = url.query_pairs().collect();
    let states: Vec<_> = query.iter().filter(|(k, _)| k == "state").collect();
    if states.len() != 1 || states[0].1 != state {
        return Err(error("NATIVE_STATE_MISMATCH"));
    }
    if query.iter().any(|(k, _)| k == "error") {
        return Err(error("NATIVE_LOGIN_CANCELLED"));
    }
    let codes: Vec<_> = query.iter().filter(|(k, _)| k == "code").collect();
    if codes.len() != 1 || codes[0].1.is_empty() || codes[0].1.len() > 2048 {
        return Err(error("NATIVE_CALLBACK_INVALID"));
    }
    Ok(codes[0].1.to_string())
}
struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
pub async fn native_auth_login(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, NativeAuthState>,
) -> Result<BrowserSession, String> {
    require_main(&window)?;
    if state
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        return Err(error("NATIVE_LOGIN_ALREADY_RUNNING"));
    }
    let _busy = Busy(&state.busy);
    let verifier = windows::random()?;
    let csrf = windows::random()?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| error("NATIVE_CALLBACK_UNAVAILABLE"))?;
    let port = listener
        .local_addr()
        .map_err(|_| error("NATIVE_CALLBACK_UNAVAILABLE"))?
        .port();
    let redirect = format!("http://127.0.0.1:{port}/callback");
    let mut authorize = url::Url::parse(&format!("{ISSUER}/oauth/authorize"))
        .map_err(|_| error("NATIVE_CONFIGURATION_INVALID"))?;
    authorize.query_pairs_mut().extend_pairs([
        ("client_id", CLIENT_ID),
        ("response_type", "code"),
        ("redirect_uri", redirect.as_str()),
        ("scope", "openid email profile offline_access"),
        ("state", csrf.as_str()),
        ("code_challenge", challenge.as_str()),
        ("code_challenge_method", "S256"),
    ]);
    app.opener()
        .open_url(authorize.as_str(), None::<&str>)
        .map_err(|_| error("NATIVE_BROWSER_UNAVAILABLE"))?;
    let code = tokio::time::timeout(Duration::from_secs(300), async {
        loop {
            let (mut socket, peer) = listener.accept().await.map_err(|_| error("NATIVE_CALLBACK_UNAVAILABLE"))?;
            if !peer.ip().is_loopback() { continue; }
            let read = tokio::time::timeout(Duration::from_secs(5), async {
                let mut data=Vec::new();let mut part=[0u8;1024];
                loop {let n=socket.read(&mut part).await.map_err(|_|error("NATIVE_CALLBACK_UNAVAILABLE"))?;if n==0||data.len()+n>8192{return Err(error("NATIVE_CALLBACK_INVALID"));}data.extend_from_slice(&part[..n]);if data.windows(4).any(|w|w==b"\r\n\r\n"){break;}}
                String::from_utf8(data).map_err(|_|error("NATIVE_CALLBACK_INVALID"))
            }).await;
            let raw=match read{Ok(Ok(raw))=>raw,_=>{let _=socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;continue;}};
            let host=format!("127.0.0.1:{port}");let hosts:Vec<_>=raw.lines().filter_map(|l|l.split_once(':')).filter(|(k,_)|k.eq_ignore_ascii_case("host")).map(|(_,v)|v.trim()).collect();
            let mut parts=raw.lines().next().unwrap_or("").split_whitespace();let method=parts.next().unwrap_or("");let target=parts.next().unwrap_or("");
            if method!="GET"||hosts!=vec![host.as_str()]||target.starts_with("/favicon"){let _=socket.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;continue;}
            match callback(target,&csrf,port) {
                Ok(code)=>{let body="Login received. Return to SeekOffer Desktop. Do not share this URL.";let response=format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);let _=socket.write_all(response.as_bytes()).await;return Ok(code);}
                Err(e)=>{let _=socket.write_all(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;if e=="NATIVE_LOGIN_CANCELLED"{return Err(e);}}
            }
        }
    }).await.map_err(|_| error("NATIVE_LOGIN_TIMEOUT"))??;
    drop(listener);
    let response = exchange(&[
        ("grant_type", "authorization_code"),
        ("client_id", CLIENT_ID),
        ("code", &code),
        ("redirect_uri", &redirect),
        ("code_verifier", &verifier),
    ])
    .await?;
    let (access_token, refresh_token, expires_at) = tokens(&response)?;
    let user = json(
        http()?
            .get(format!("{ISSUER}/oauth/userinfo"))
            .bearer_auth(&access_token)
            .send()
            .await
            .map_err(|_| error("NATIVE_AUTH_UNAVAILABLE"))?,
    )
    .await?;
    let subject = user["sub"]
        .as_str()
        .filter(|s| s.starts_with("user_") && s.len() <= 80)
        .ok_or_else(|| error("NATIVE_IDENTITY_INVALID"))?
        .to_string();
    let email = user["email"]
        .as_str()
        .filter(|s| s.len() <= 254)
        .ok_or_else(|| error("NATIVE_EMAIL_UNAVAILABLE"))?
        .to_string();
    let stored = StoredSession {
        access_token,
        refresh_token,
        expires_at,
        subject,
        email,
        session_id: windows::random()?,
        established_at: now(),
    };
    let mut current = state.session.lock().await;
    save(&app, &stored)?;
    let public = BrowserSession::from(&stored);
    *current = Some(stored);
    Ok(public)
}

#[tauri::command]
pub async fn native_auth_session(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, NativeAuthState>,
) -> Result<Option<BrowserSession>, String> {
    require_main(&window)?;
    let mut current = state.session.lock().await;
    if current.is_none() {
        *current = load(&app)?;
    }
    let Some(s) = current.as_mut() else {
        return Ok(None);
    };
    // Require an explicit browser login at least every seven days. Refresh tokens
    // are kept only in DPAPI, never used to create an unlimited application session.
    if now().saturating_sub(s.established_at) > 7 * 86400 {
        return Err(error("NATIVE_REAUTHENTICATION_REQUIRED"));
    }
    if s.expires_at <= now() + 60 {
        let response = exchange(&[
            ("grant_type", "refresh_token"),
            ("client_id", CLIENT_ID),
            ("refresh_token", &s.refresh_token),
        ])
        .await?;
        let (a, r, e) = tokens(&response)?;
        s.access_token = a;
        s.refresh_token = r;
        s.expires_at = e;
        save(&app, s)?;
    }
    Ok(Some(BrowserSession::from(&*s)))
}
#[tauri::command]
pub async fn native_auth_sign_out(
    window: tauri::WebviewWindow,
    app: AppHandle,
    state: State<'_, NativeAuthState>,
) -> Result<(), String> {
    require_main(&window)?;
    let mut current = state.session.lock().await;
    let saved = if current.is_some() {
        current.clone()
    } else {
        load(&app)?
    };
    if let Some(s) = saved {
        let _ = http()?
            .post(format!("{ISSUER}/oauth/token/revoke"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form(&[
                ("client_id", CLIENT_ID),
                ("token", &s.refresh_token),
                ("token_type_hint", "refresh_token"),
            ]))
            .send()
            .await;
    }
    let p = file(&app)?;
    if p.exists() {
        std::fs::remove_file(p).map_err(|_| error("NATIVE_STORAGE_UNAVAILABLE"))?;
    }
    *current = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pkce_rfc_vector() {
        assert_eq!(
            URL_SAFE_NO_PAD.encode(Sha256::digest(
                b"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
            )),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
    #[test]
    fn callback_is_bound() {
        assert_eq!(
            callback("/callback?state=synthetic&code=code", "synthetic", 1234).unwrap(),
            "code"
        );
        for target in [
            "/callback?state=other&code=x",
            "/callback?state=synthetic&state=synthetic&code=x",
            "https://untrusted/callback?state=synthetic&code=x",
            "/wrong?state=synthetic&code=x",
        ] {
            assert!(callback(target, "synthetic", 1234).is_err());
        }
    }
    #[cfg(windows)]
    #[test]
    fn dpapi_roundtrip() {
        let raw = b"synthetic-local-token-not-real";
        let encrypted = windows::crypt(raw, true).unwrap();
        assert_ne!(encrypted, raw);
        assert_eq!(windows::crypt(&encrypted, false).unwrap(), raw);
        assert!(windows::crypt(b"corrupt", false).is_err());
    }
    #[test]
    fn bounded_tokens() {
        assert!(tokens(&serde_json::json!({"access_token":"x","refresh_token":"y","token_type":"Bearer","expires_in":86400})).is_ok());
        assert!(tokens(&serde_json::json!({"access_token":"x","refresh_token":"y","token_type":"Bearer","expires_in":99999999})).is_err());
    }
}
