use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use reqwest::{header, redirect::Policy, Client, Response, StatusCode};
use scraper::{Html, Selector};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Manager, WebviewWindow};
use url::{Host, Url};

const MAX_HOMEPAGE_LENGTH: usize = 500;
const MAX_REDIRECTS: usize = 3;
const MAX_HTML_BYTES: usize = 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;
const MAX_IMAGE_CANDIDATES: usize = 5;
const MIN_IMAGE_EDGE: usize = 120;
const MAX_IMAGE_EDGE: usize = 4096;
const MAX_IMAGE_PIXELS: usize = 16_000_000;
const CACHE_DIR_NAME: &str = "mentor-photos";

#[derive(Default)]
pub struct MentorPhotoState {
    busy: AtomicBool,
}

struct BusyGuard<'a> {
    state: &'a MentorPhotoState,
}

impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.state.busy.store(false, Ordering::Release);
    }
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MentorPhotoPayload {
    mime_type: String,
    bytes_base64: String,
    cache_key: String,
    source_url: String,
    page_url: String,
    width: usize,
    height: usize,
    confidence: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedMentorPhotoPayload {
    mime_type: String,
    bytes_base64: String,
    width: usize,
    height: usize,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MentorPhotoCommandError {
    code: String,
    message: String,
    retryable: bool,
}

impl MentorPhotoCommandError {
    fn new(code: &str, message: &str, retryable: bool) -> Self {
        Self {
            code: code.to_owned(),
            message: message.to_owned(),
            retryable,
        }
    }

    fn invalid_url() -> Self {
        Self::new(
            "MENTOR_PHOTO_INVALID_URL",
            "请输入完整的导师主页地址。",
            false,
        )
    }

    fn blocked_destination() -> Self {
        Self::new(
            "MENTOR_PHOTO_BLOCKED_DESTINATION",
            "该主页地址不属于可安全读取的公开网络。",
            false,
        )
    }

    fn timeout() -> Self {
        Self::new(
            "MENTOR_PHOTO_TIMEOUT",
            "读取导师主页超时，请稍后重试。",
            true,
        )
    }

    fn not_found() -> Self {
        Self::new(
            "MENTOR_PHOTO_NOT_FOUND",
            "主页中未找到可用的导师照片。",
            false,
        )
    }

    fn cache_error() -> Self {
        Self::new(
            "MENTOR_PHOTO_CACHE_ERROR",
            "照片暂时无法保存到本机，请稍后重试。",
            true,
        )
    }
}

#[derive(Clone, Debug)]
struct PhotoCandidate {
    url: Url,
    score: i32,
}

#[derive(Clone, Debug)]
struct ValidatedImage {
    mime_type: &'static str,
    extension: &'static str,
    width: usize,
    height: usize,
    bytes: Vec<u8>,
}

fn ensure_main_window(window: &WebviewWindow) -> Result<(), MentorPhotoCommandError> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_COMMAND_NOT_ALLOWED",
            "当前窗口不能读取导师主页。",
            false,
        ))
    }
}

fn acquire_busy_guard(state: &MentorPhotoState) -> Result<BusyGuard<'_>, MentorPhotoCommandError> {
    state
        .busy
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .map_err(|_| {
            MentorPhotoCommandError::new(
                "MENTOR_PHOTO_BUSY",
                "正在查找另一位导师的照片，请稍候。",
                true,
            )
        })?;
    Ok(BusyGuard { state })
}

fn parse_public_url(raw: &str) -> Result<Url, MentorPhotoCommandError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_HOMEPAGE_LENGTH {
        return Err(MentorPhotoCommandError::invalid_url());
    }
    let mut url = Url::parse(trimmed).map_err(|_| MentorPhotoCommandError::invalid_url())?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(MentorPhotoCommandError::invalid_url());
    }
    let expected_port = if url.scheme() == "https" { 443 } else { 80 };
    if url.port_or_known_default() != Some(expected_port) {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUPPORTED_PORT",
            "导师主页暂只支持标准 HTTP 或 HTTPS 端口。",
            false,
        ));
    }
    let host = match url.host() {
        Some(Host::Domain(host)) => host.trim_end_matches('.').to_ascii_lowercase(),
        _ => return Err(MentorPhotoCommandError::blocked_destination()),
    };
    if !host.contains('.')
        || host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
    {
        return Err(MentorPhotoCommandError::blocked_destination());
    }
    url.set_fragment(None);
    Ok(url)
}

fn is_public_ipv4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    !(a == 0
        || a == 10
        || a == 127
        || a >= 224
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || (a == 198 && (b == 18 || b == 19))
        || (a == 192 && b == 0 && c == 0)
        || (a == 192 && b == 0 && c == 2)
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113))
}

fn is_public_ipv6(ip: Ipv6Addr) -> bool {
    if ip.is_unspecified() || ip.is_loopback() || ip.is_multicast() {
        return false;
    }
    if let Some(mapped) = ip.to_ipv4_mapped() {
        return is_public_ipv4(mapped);
    }
    let segments = ip.segments();
    (segments[0] & 0xfe00) != 0xfc00
        && (segments[0] & 0xffc0) != 0xfe80
        && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_public_ipv4(ip),
        IpAddr::V6(ip) => is_public_ipv6(ip),
    }
}

async fn resolve_public_addresses(url: &Url) -> Result<Vec<SocketAddr>, MentorPhotoCommandError> {
    let host = url
        .host_str()
        .ok_or_else(MentorPhotoCommandError::invalid_url)?;
    let port = url
        .port_or_known_default()
        .ok_or_else(MentorPhotoCommandError::invalid_url)?;
    let addresses: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|_| {
            MentorPhotoCommandError::new(
                "MENTOR_PHOTO_NETWORK_ERROR",
                "暂时无法解析导师主页地址。",
                true,
            )
        })?
        .collect();
    if addresses.is_empty() || addresses.iter().any(|address| !is_public_ip(address.ip())) {
        return Err(MentorPhotoCommandError::blocked_destination());
    }
    Ok(addresses)
}

fn build_pinned_client(
    host: &str,
    addresses: &[SocketAddr],
) -> Result<Client, MentorPhotoCommandError> {
    Client::builder()
        .redirect(Policy::none())
        .no_proxy()
        .referer(false)
        .connect_timeout(Duration::from_secs(3))
        .read_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .user_agent(format!(
            "SeekOfferDesktop/{} mentor-photo",
            env!("CARGO_PKG_VERSION")
        ))
        .resolve_to_addrs(host, addresses)
        .build()
        .map_err(|_| {
            MentorPhotoCommandError::new(
                "MENTOR_PHOTO_NETWORK_ERROR",
                "暂时无法建立安全的主页连接。",
                true,
            )
        })
}

fn map_reqwest_error(error: reqwest::Error) -> MentorPhotoCommandError {
    if error.is_timeout() {
        MentorPhotoCommandError::timeout()
    } else {
        MentorPhotoCommandError::new(
            "MENTOR_PHOTO_NETWORK_ERROR",
            "暂时无法读取导师主页，请稍后重试。",
            true,
        )
    }
}

async fn read_bounded_response(
    mut response: Response,
    max_bytes: usize,
) -> Result<Vec<u8>, MentorPhotoCommandError> {
    if response
        .content_length()
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_RESPONSE_TOO_LARGE",
            "主页或照片内容过大，已停止读取。",
            false,
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_reqwest_error)? {
        if bytes.len().saturating_add(chunk.len()) > max_bytes {
            return Err(MentorPhotoCommandError::new(
                "MENTOR_PHOTO_RESPONSE_TOO_LARGE",
                "主页或照片内容过大，已停止读取。",
                false,
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

async fn fetch_with_redirects(
    raw_url: Url,
    max_bytes: usize,
    accept: &str,
) -> Result<(Url, String, Vec<u8>), MentorPhotoCommandError> {
    let mut current = raw_url;
    for redirect_index in 0..=MAX_REDIRECTS {
        let validated = parse_public_url(current.as_str())?;
        let host = validated
            .host_str()
            .ok_or_else(MentorPhotoCommandError::invalid_url)?;
        let addresses = resolve_public_addresses(&validated).await?;
        let client = build_pinned_client(host, &addresses)?;
        let response = client
            .get(validated.clone())
            .header(header::ACCEPT, accept)
            .send()
            .await
            .map_err(map_reqwest_error)?;

        if response.status().is_redirection() {
            if redirect_index == MAX_REDIRECTS {
                return Err(MentorPhotoCommandError::new(
                    "MENTOR_PHOTO_TOO_MANY_REDIRECTS",
                    "导师主页重定向次数过多。",
                    false,
                ));
            }
            let location = response
                .headers()
                .get(header::LOCATION)
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| {
                    MentorPhotoCommandError::new(
                        "MENTOR_PHOTO_UNSUPPORTED_PAGE",
                        "导师主页返回了无法识别的跳转。",
                        false,
                    )
                })?;
            let next = validated
                .join(location)
                .map_err(|_| MentorPhotoCommandError::invalid_url())?;
            if validated.scheme() == "https" && next.scheme() != "https" {
                return Err(MentorPhotoCommandError::new(
                    "MENTOR_PHOTO_HTTPS_DOWNGRADE",
                    "导师主页尝试跳转到不安全的连接，已停止读取。",
                    false,
                ));
            }
            current = next;
            continue;
        }

        if matches!(
            response.status(),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
        ) {
            return Err(MentorPhotoCommandError::new(
                "MENTOR_PHOTO_BLOCKED_PAGE",
                "该主页需要登录或禁止自动读取。",
                false,
            ));
        }
        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            return Err(MentorPhotoCommandError::new(
                "MENTOR_PHOTO_RATE_LIMITED",
                "该主页请求过于频繁，请稍后重试。",
                true,
            ));
        }
        if !response.status().is_success() {
            return Err(MentorPhotoCommandError::new(
                "MENTOR_PHOTO_UNSUPPORTED_PAGE",
                "导师主页暂时无法读取。",
                response.status().is_server_error(),
            ));
        }

        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        let bytes = read_bounded_response(response, max_bytes).await?;
        return Ok((validated, content_type, bytes));
    }
    Err(MentorPhotoCommandError::not_found())
}

fn candidate_score(text: &str, base: i32) -> i32 {
    let normalized = text.to_ascii_lowercase();
    let positive = [
        "photo", "portrait", "avatar", "profile", "teacher", "faculty", "staff", "导师", "教师",
        "头像", "照片",
    ];
    let negative = [
        "logo", "icon", "banner", "header", "footer", "qr", "wechat", "spacer", "sprite", "advert",
    ];
    let mut score = base;
    for keyword in positive {
        if normalized.contains(keyword) {
            score += 18;
        }
    }
    for keyword in negative {
        if normalized.contains(keyword) {
            score -= 65;
        }
    }
    score
}

fn push_candidate(
    candidates: &mut Vec<PhotoCandidate>,
    seen: &mut HashSet<String>,
    page_url: &Url,
    raw_url: &str,
    score: i32,
) {
    let raw = raw_url.trim();
    if raw.is_empty() || raw.starts_with("data:") || raw.starts_with("blob:") {
        return;
    }
    let Ok(url) = page_url.join(raw) else {
        return;
    };
    if !matches!(url.scheme(), "http" | "https") {
        return;
    }
    let key = url.as_str().to_owned();
    if seen.insert(key) && score >= 18 {
        candidates.push(PhotoCandidate { url, score });
    }
}

fn extract_photo_candidates(html: &str, page_url: &Url) -> Vec<PhotoCandidate> {
    let document = Html::parse_document(html);
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    let meta_selector = Selector::parse("meta[property], meta[name]").expect("static selector");
    for element in document.select(&meta_selector) {
        let property = element
            .value()
            .attr("property")
            .or_else(|| element.value().attr("name"))
            .unwrap_or("")
            .to_ascii_lowercase();
        let base = match property.as_str() {
            "og:image" | "og:image:url" => 65,
            "twitter:image" | "twitter:image:src" => 60,
            _ => continue,
        };
        if let Some(content) = element.value().attr("content") {
            push_candidate(
                &mut candidates,
                &mut seen,
                page_url,
                content,
                candidate_score(content, base),
            );
        }
    }

    let link_selector = Selector::parse("link[rel]").expect("static selector");
    for element in document.select(&link_selector) {
        let rel = element
            .value()
            .attr("rel")
            .unwrap_or("")
            .to_ascii_lowercase();
        if rel.split_whitespace().any(|item| item == "image_src") {
            if let Some(href) = element.value().attr("href") {
                push_candidate(
                    &mut candidates,
                    &mut seen,
                    page_url,
                    href,
                    candidate_score(href, 58),
                );
            }
        }
    }

    let image_selector = Selector::parse("img").expect("static selector");
    for element in document.select(&image_selector) {
        let attributes = element.value();
        let source = attributes
            .attr("src")
            .or_else(|| attributes.attr("data-src"))
            .or_else(|| attributes.attr("data-original"));
        let Some(source) = source else {
            continue;
        };
        let context = format!(
            "{} {} {} {}",
            source,
            attributes.attr("alt").unwrap_or(""),
            attributes.attr("class").unwrap_or(""),
            attributes.attr("id").unwrap_or("")
        );
        let mut score = candidate_score(&context, 10);
        let width = attributes
            .attr("width")
            .and_then(|value| value.parse::<usize>().ok());
        let height = attributes
            .attr("height")
            .and_then(|value| value.parse::<usize>().ok());
        if width.is_some_and(|value| value >= MIN_IMAGE_EDGE)
            && height.is_some_and(|value| value >= MIN_IMAGE_EDGE)
        {
            score += 12;
        }
        push_candidate(&mut candidates, &mut seen, page_url, source, score);
    }

    candidates.sort_by(|left, right| right.score.cmp(&left.score));
    candidates.truncate(MAX_IMAGE_CANDIDATES);
    candidates
}

fn detect_image_type(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some(("image/jpeg", "jpg"));
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Some(("image/png", "png"));
    }
    if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some(("image/webp", "webp"));
    }
    None
}

fn validate_image(
    content_type: &str,
    bytes: Vec<u8>,
) -> Result<ValidatedImage, MentorPhotoCommandError> {
    let (mime_type, extension) = detect_image_type(&bytes).ok_or_else(|| {
        MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUPPORTED_IMAGE",
            "主页中的候选图片格式暂不支持。",
            false,
        )
    })?;
    let compatible_content_type = content_type.is_empty()
        || content_type == mime_type
        || content_type == "application/octet-stream"
        || (mime_type == "image/jpeg" && matches!(content_type, "image/jpg" | "image/pjpeg"));
    if !compatible_content_type {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUPPORTED_IMAGE",
            "主页返回的图片类型不一致，已停止使用。",
            false,
        ));
    }
    let dimensions = imagesize::blob_size(&bytes).map_err(|_| {
        MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUPPORTED_IMAGE",
            "主页中的候选图片无法读取。",
            false,
        )
    })?;
    let (width, height) = (dimensions.width, dimensions.height);
    let pixels = width.saturating_mul(height);
    let ratio = width as f64 / height.max(1) as f64;
    if width < MIN_IMAGE_EDGE
        || height < MIN_IMAGE_EDGE
        || width > MAX_IMAGE_EDGE
        || height > MAX_IMAGE_EDGE
        || pixels > MAX_IMAGE_PIXELS
        || !(0.45..=1.8).contains(&ratio)
    {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUITABLE_IMAGE",
            "主页中的图片尺寸不适合作为导师头像。",
            false,
        ));
    }
    Ok(ValidatedImage {
        mime_type,
        extension,
        width,
        height,
        bytes,
    })
}

fn photo_cache_dir(app: &AppHandle) -> Result<PathBuf, MentorPhotoCommandError> {
    app.path()
        .app_cache_dir()
        .map(|path| path.join(CACHE_DIR_NAME))
        .map_err(|_| MentorPhotoCommandError::cache_error())
}

fn cache_photo(app: &AppHandle, image: &ValidatedImage) -> Result<String, MentorPhotoCommandError> {
    let hash = Sha256::digest(&image.bytes);
    let hash_hex = hash
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let cache_key = format!("{hash_hex}.{}", image.extension);
    let directory = photo_cache_dir(app)?;
    std::fs::create_dir_all(&directory).map_err(|_| MentorPhotoCommandError::cache_error())?;
    let path = directory.join(&cache_key);
    if !path.exists() {
        let temporary = directory.join(format!(".{cache_key}.tmp"));
        std::fs::write(&temporary, &image.bytes)
            .map_err(|_| MentorPhotoCommandError::cache_error())?;
        std::fs::rename(&temporary, &path).map_err(|_| {
            let _ = std::fs::remove_file(&temporary);
            MentorPhotoCommandError::cache_error()
        })?;
    }
    Ok(cache_key)
}

fn is_valid_cache_key(cache_key: &str) -> bool {
    let mut parts = cache_key.split('.');
    let Some(hash) = parts.next() else {
        return false;
    };
    let Some(extension) = parts.next() else {
        return false;
    };
    parts.next().is_none()
        && hash.len() == 64
        && hash
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        && matches!(extension, "jpg" | "png" | "webp")
}

#[tauri::command]
pub async fn resolve_mentor_photo(
    window: WebviewWindow,
    app: AppHandle,
    state: tauri::State<'_, MentorPhotoState>,
    homepage: String,
) -> Result<MentorPhotoPayload, MentorPhotoCommandError> {
    ensure_main_window(&window)?;
    let _busy_guard = acquire_busy_guard(&state)?;
    let homepage_url = parse_public_url(&homepage)?;
    let (page_url, content_type, html_bytes) = fetch_with_redirects(
        homepage_url,
        MAX_HTML_BYTES,
        "text/html,application/xhtml+xml;q=0.9",
    )
    .await?;
    if !matches!(content_type.as_str(), "text/html" | "application/xhtml+xml") {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_UNSUPPORTED_PAGE",
            "该地址不是可读取的导师主页。",
            false,
        ));
    }
    let html = String::from_utf8_lossy(&html_bytes);
    let candidates = extract_photo_candidates(&html, &page_url);
    if candidates.is_empty() {
        return Err(MentorPhotoCommandError::not_found());
    }

    for candidate in candidates {
        let fetched = fetch_with_redirects(
            candidate.url.clone(),
            MAX_IMAGE_BYTES,
            "image/jpeg,image/png,image/webp",
        )
        .await;
        let Ok((source_url, image_content_type, bytes)) = fetched else {
            continue;
        };
        let Ok(image) = validate_image(&image_content_type, bytes) else {
            continue;
        };
        let cache_key = cache_photo(&app, &image)?;
        return Ok(MentorPhotoPayload {
            mime_type: image.mime_type.to_owned(),
            bytes_base64: BASE64_STANDARD.encode(&image.bytes),
            cache_key,
            source_url: source_url.to_string(),
            page_url: page_url.to_string(),
            width: image.width,
            height: image.height,
            confidence: if candidate.score >= 78 {
                "high"
            } else {
                "medium"
            }
            .to_owned(),
        });
    }
    Err(MentorPhotoCommandError::not_found())
}

#[tauri::command]
pub fn load_cached_mentor_photo(
    window: WebviewWindow,
    app: AppHandle,
    cache_key: String,
) -> Result<CachedMentorPhotoPayload, MentorPhotoCommandError> {
    ensure_main_window(&window)?;
    let normalized = cache_key.trim().to_ascii_lowercase();
    if !is_valid_cache_key(&normalized) {
        return Err(MentorPhotoCommandError::new(
            "MENTOR_PHOTO_INVALID_CACHE_KEY",
            "导师照片缓存标识无效。",
            false,
        ));
    }
    let path = photo_cache_dir(&app)?.join(&normalized);
    let metadata = std::fs::metadata(&path).map_err(|_| {
        MentorPhotoCommandError::new(
            "MENTOR_PHOTO_CACHE_MISSING",
            "本机尚未缓存这张导师照片。",
            false,
        )
    })?;
    if metadata.len() > MAX_IMAGE_BYTES as u64 {
        return Err(MentorPhotoCommandError::cache_error());
    }
    let bytes = std::fs::read(path).map_err(|_| MentorPhotoCommandError::cache_error())?;
    let image = validate_image("", bytes)?;
    Ok(CachedMentorPhotoPayload {
        mime_type: image.mime_type.to_owned(),
        bytes_base64: BASE64_STANDARD.encode(&image.bytes),
        width: image.width,
        height: image.height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_private_and_special_ipv4_ranges() {
        for ip in [
            "0.0.0.1",
            "10.0.0.1",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.1.1",
            "172.16.0.1",
            "192.168.1.1",
            "198.18.0.1",
            "192.0.2.1",
            "203.0.113.1",
            "224.0.0.1",
        ] {
            assert!(!is_public_ip(ip.parse().expect("valid ip")), "{ip}");
        }
        assert!(is_public_ip("8.8.8.8".parse().expect("valid ip")));
    }

    #[test]
    fn rejects_private_and_documentation_ipv6_ranges() {
        for ip in ["::", "::1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1"] {
            assert!(!is_public_ip(ip.parse().expect("valid ip")), "{ip}");
        }
        assert!(is_public_ip(
            "2606:4700:4700::1111".parse().expect("valid ip")
        ));
    }

    #[test]
    fn only_accepts_public_standard_http_urls() {
        assert!(parse_public_url("https://faculty.example.edu/mentor").is_ok());
        for url in [
            "file:///etc/passwd",
            "data:text/html,unsafe",
            "javascript:alert(1)",
            "http://localhost/mentor",
            "https://user:pass@example.edu/mentor",
            "https://example.edu:8443/mentor",
            "https://127.0.0.1/mentor",
        ] {
            assert!(parse_public_url(url).is_err(), "{url}");
        }
    }

    #[test]
    fn candidate_ranking_avoids_logos_and_keeps_portraits() {
        let page = Url::parse("https://faculty.example.edu/mentor").expect("page url");
        let html = r#"
          <html><head><meta property="og:image" content="/assets/site-logo.png"></head>
          <body>
            <img class="faculty-profile-photo" alt="教师照片" src="/people/mentor.jpg" width="480" height="640">
            <img class="footer-logo" src="/assets/logo-secondary.png" width="300" height="300">
          </body></html>
        "#;
        let candidates = extract_photo_candidates(html, &page);
        assert_eq!(
            candidates.first().map(|item| item.url.path()),
            Some("/people/mentor.jpg")
        );
    }

    #[test]
    fn validates_cache_keys_and_supported_magic_bytes() {
        assert!(is_valid_cache_key(&format!("{}.jpg", "a".repeat(64))));
        assert!(!is_valid_cache_key("../mentor.jpg"));
        assert_eq!(
            detect_image_type(&[0xff, 0xd8, 0xff, 0x00]),
            Some(("image/jpeg", "jpg"))
        );
        assert_eq!(detect_image_type(b"<svg></svg>"), None);
    }
}
