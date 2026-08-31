use base64::{engine::general_purpose::STANDARD, Engine as _};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs, path::Path};

fn decode_tauri_value(label: &str, encoded: &str) -> Result<String, String> {
    let decoded = STANDARD
        .decode(encoded)
        .map_err(|error| format!("{label} 不是有效的 Base64：{error}"))?;
    String::from_utf8(decoded).map_err(|error| format!("{label} 解码后不是 UTF-8：{error}"))
}

fn verify_updater_signature(
    installer: &[u8],
    encoded_signature: &str,
    encoded_public_key: &str,
) -> Result<(), String> {
    // Keep this in lockstep with tauri-plugin-updater 2.10.1:
    // both config.pubkey and the latest.json signature are Base64 wrappers
    // around the complete Minisign text records, and legacy signatures are
    // accepted by the updater's verifier.
    let public_key_text = decode_tauri_value("Tauri updater 公钥", encoded_public_key)?;
    let public_key = PublicKey::decode(&public_key_text)
        .map_err(|error| format!("Tauri updater 公钥无法解析：{error}"))?;
    let signature_text = decode_tauri_value("Tauri updater 签名", encoded_signature)?;
    let signature = Signature::decode(&signature_text)
        .map_err(|error| format!("Tauri updater 签名无法解析：{error}"))?;

    public_key
        .verify(installer, &signature, true)
        .map_err(|error| format!("安装包与 Tauri updater 签名不匹配：{error}"))
}

fn verify_files(
    installer_path: &Path,
    signature_path: &Path,
    encoded_public_key: &str,
) -> Result<(), String> {
    let installer = fs::read(installer_path)
        .map_err(|error| format!("无法读取安装包 {}：{error}", installer_path.display()))?;
    let encoded_signature = fs::read_to_string(signature_path)
        .map_err(|error| format!("无法读取签名 {}：{error}", signature_path.display()))?;

    // package-desktop-release.mjs writes this normalized value to latest.json;
    // verify the exact representation the runtime updater will receive.
    verify_updater_signature(
        &installer,
        encoded_signature.trim(),
        encoded_public_key.trim(),
    )
}

fn run() -> Result<(), String> {
    let mut arguments = env::args_os().skip(1);
    let installer_path = arguments.next().ok_or_else(|| {
        "用法：verify_updater_signature <installer.exe> <installer.exe.sig> <tauri-pubkey>"
            .to_string()
    })?;
    let signature_path = arguments.next().ok_or_else(|| {
        "用法：verify_updater_signature <installer.exe> <installer.exe.sig> <tauri-pubkey>"
            .to_string()
    })?;
    let encoded_public_key = arguments.next().ok_or_else(|| {
        "用法：verify_updater_signature <installer.exe> <installer.exe.sig> <tauri-pubkey>"
            .to_string()
    })?;
    if arguments.next().is_some() {
        return Err("验签参数过多，拒绝继续".to_string());
    }
    let encoded_public_key = encoded_public_key
        .into_string()
        .map_err(|_| "Tauri updater 公钥参数不是有效 UTF-8".to_string())?;

    verify_files(
        Path::new(&installer_path),
        Path::new(&signature_path),
        &encoded_public_key,
    )
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
    println!("Tauri updater Minisign 验签通过");
}

#[cfg(test)]
mod tests {
    use super::verify_updater_signature;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    const PUBLIC_KEY_TEXT: &str = concat!(
        "untrusted comment: minisign public key\n",
        "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n"
    );
    const SIGNATURE_TEXT: &str = concat!(
        "untrusted comment: signature from minisign secret key\n",
        "RWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\n",
        "trusted comment: timestamp:1555779966\tfile:test\n",
        "QtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA=="
    );

    fn fixture_values() -> (String, String) {
        (
            STANDARD.encode(SIGNATURE_TEXT),
            STANDARD.encode(PUBLIC_KEY_TEXT),
        )
    }

    #[test]
    fn accepts_the_same_valid_signature_as_tauri_updater() {
        let (signature, public_key) = fixture_values();
        verify_updater_signature(b"test", &signature, &public_key).unwrap();
    }

    #[test]
    fn rejects_tampered_installer_bytes() {
        let (signature, public_key) = fixture_values();
        let error = verify_updater_signature(b"tampered", &signature, &public_key).unwrap_err();
        assert!(error.contains("不匹配"));
    }

    #[test]
    fn rejects_a_different_public_key() {
        let (signature, _) = fixture_values();
        let wrong_public_key = STANDARD.encode(concat!(
            "untrusted comment: another minisign public key\n",
            "RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO2\n"
        ));
        assert!(verify_updater_signature(b"test", &signature, &wrong_public_key).is_err());
    }
}
