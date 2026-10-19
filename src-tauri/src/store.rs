use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

pub const FILE_NAME: &str = "folio.wallet.json";
pub const MAX_BYTES: usize = 12 * 1024 * 1024;

pub fn reserved_backup_name(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return true;
    };
    // Windows resolves file names without case and ignores trailing spaces/dots.
    let name = name.trim_end_matches(['.', ' ']);
    [
        FILE_NAME,
        ".folio.lock",
        "storage-location.json",
        "preferences.json",
    ]
    .iter()
    .any(|reserved| name.eq_ignore_ascii_case(reserved))
}

#[derive(Clone, Serialize, Deserialize)]
pub struct WalletFile {
    pub format: String,
    pub version: u32,
    pub revision: u64,
    pub payload: Value,
}

#[derive(Serialize)]
pub struct WalletView {
    pub directory: String,
    pub revision: u64,
    pub payload: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryChoice {
    pub directory: String,
    pub has_wallet: bool,
    pub entries: Option<usize>,
    pub encrypted: bool,
}

#[derive(Serialize, Deserialize)]
struct Location {
    directory: PathBuf,
}

pub struct Store {
    pub directory: PathBuf,
    config_file: PathBuf,
    pub pending: Option<PathBuf>,
}

fn error(context: &str, error: impl std::fmt::Display) -> String {
    format!("{context}：{error}")
}

pub fn encrypted(payload: &Value) -> bool {
    payload.get("format").and_then(Value::as_str) == Some("mrgcard-encrypted")
}

pub fn validate_payload(payload: &Value) -> Result<(), String> {
    if !payload.is_object() || payload.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("不支持的资料格式，原文件未修改。".into());
    }
    if serde_json::to_vec(payload)
        .map_err(|e| error("无法序列化资料", e))?
        .len()
        > MAX_BYTES
    {
        return Err("资料超过 12 MB，请减少自定义图片。".into());
    }
    if encrypted(payload) {
        let base64 = |name: &str, expected: Option<usize>| {
            payload.get(name).and_then(Value::as_str).is_some_and(|s| {
                !s.is_empty()
                    && expected.is_none_or(|n| s.len() == n)
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
            })
        };
        if payload.get("iterations").and_then(Value::as_u64) != Some(600_000)
            || !base64("salt", Some(24))
            || !base64("iv", Some(16))
            || !base64("data", None)
        {
            return Err("加密资料格式不正确。".into());
        }
    } else {
        let entries = payload
            .get("entries")
            .and_then(Value::as_array)
            .ok_or("记录格式不正确。")?;
        if entries.len() > 2000 {
            return Err("记录不能超过 2,000 条。".into());
        }
        let mut ids = std::collections::HashSet::new();
        for entry in entries {
            let id = entry
                .get("id")
                .and_then(Value::as_str)
                .ok_or("记录缺少 ID。")?;
            if id.is_empty()
                || id.len() > 80
                || !id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
                || !ids.insert(id)
            {
                return Err("记录 ID 无效或重复。".into());
            }
            if !matches!(
                entry.get("type").and_then(Value::as_str),
                Some("bank" | "crypto" | "sim" | "address")
            ) || !entry
                .get("name")
                .and_then(Value::as_str)
                .is_some_and(|s| !s.trim().is_empty())
            {
                return Err("记录类型或名称无效。".into());
            }
        }
    }
    Ok(())
}

fn lock(directory: &Path) -> Result<File, String> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(directory.join(".folio.lock"))
        .map_err(|e| error("无法锁定资料目录", e))?;
    file.try_lock_exclusive()
        .map_err(|_| "此目录正在被另一个 Folio 窗口使用，请稍后重试。".to_string())?;
    Ok(file)
}

pub fn atomic_write(path: &Path, bytes: &[u8], replace: bool) -> Result<(), String> {
    let parent = path.parent().ok_or("保存路径无效。")?;
    let mut temp =
        tempfile::NamedTempFile::new_in(parent).map_err(|e| error("无法创建临时文件", e))?;
    temp.write_all(bytes)
        .and_then(|_| temp.as_file().sync_all())
        .map_err(|e| error("写入文件失败", e))?;
    if replace {
        temp.persist(path)
            .map_err(|e| error("替换文件失败，原文件已保留", e.error))?;
    } else {
        temp.persist_noclobber(path)
            .map_err(|e| error("目标已有文件，未覆盖", e.error))?;
    }
    Ok(())
}

fn read(directory: &Path) -> Result<WalletFile, String> {
    let path = directory.join(FILE_NAME);
    let metadata = fs::symlink_metadata(&path).map_err(|e| error("无法读取资料文件", e))?;
    if !metadata.is_file() || metadata.len() > (MAX_BYTES + 1024) as u64 {
        return Err("资料文件类型或大小不正确，原文件已保留。".into());
    }
    let bytes = fs::read(path).map_err(|e| error("无法读取资料", e))?;
    let wallet: WalletFile = serde_json::from_slice(&bytes)
        .map_err(|_| "资料文件损坏，原文件已保留。请使用备份或选择其他资料目录。".to_string())?;
    if wallet.format != "folio-local-wallet"
        || wallet.version != 1
        || wallet.revision > 9_007_199_254_740_990
    {
        return Err("不支持的本地资料文件版本。".into());
    }
    validate_payload(&wallet.payload)?;
    Ok(wallet)
}

fn empty() -> WalletFile {
    WalletFile {
        format: "folio-local-wallet".into(),
        version: 1,
        revision: 0,
        payload: json!({"version":1,"entries":[],"updatedAt":"1970-01-01T00:00:00.000Z"}),
    }
}

fn write(directory: &Path, wallet: &WalletFile, replace: bool) -> Result<(), String> {
    atomic_write(
        &directory.join(FILE_NAME),
        &serde_json::to_vec(wallet).map_err(|e| error("无法序列化资料", e))?,
        replace,
    )
}

impl Store {
    pub fn unavailable(config_file: PathBuf, directory: PathBuf) -> Self {
        Self {
            directory,
            config_file,
            pending: None,
        }
    }
    pub fn new(config_file: PathBuf, default_directory: PathBuf) -> Result<Self, String> {
        let directory = if config_file.exists() {
            let config: Location = serde_json::from_slice(
                &fs::read(&config_file).map_err(|e| error("无法读取位置设置", e))?,
            )
            .map_err(|_| "数据位置设置损坏，未覆盖原设置。".to_string())?;
            config.directory
        } else {
            fs::create_dir_all(&default_directory).map_err(|e| error("无法创建默认目录", e))?;
            let _lock = lock(&default_directory)?;
            if !default_directory.join(FILE_NAME).exists() {
                write(&default_directory, &empty(), false)?;
            }
            default_directory
        };
        Ok(Self {
            directory,
            config_file,
            pending: None,
        })
    }

    pub fn view(&self, wallet: WalletFile) -> WalletView {
        WalletView {
            directory: self.directory.to_string_lossy().into_owned(),
            revision: wallet.revision,
            payload: wallet.payload,
        }
    }

    pub fn check_directory(&self, expected: &str) -> Result<(), String> {
        if self.directory.to_string_lossy() != expected {
            return Err("数据目录已切换，旧窗口的保存已取消。".into());
        }
        Ok(())
    }

    pub fn load(&self) -> Result<WalletView, String> {
        let _lock = lock(&self.directory)?;
        Ok(self.view(read(&self.directory)?))
    }

    pub fn save(&self, revision: u64, payload: Value) -> Result<u64, String> {
        validate_payload(&payload)?;
        let _lock = lock(&self.directory)?;
        let previous = read(&self.directory)?;
        if previous.revision != revision {
            return Err("资料已在其他窗口更新。请关闭并重新打开 Folio 后再保存。".into());
        }
        if encrypted(&previous.payload) && !encrypted(&payload) {
            return Err("已加密资料不能降为明文保存。".into());
        }
        let next = WalletFile {
            revision: revision + 1,
            payload,
            ..previous
        };
        write(&self.directory, &next, true)?;
        Ok(next.revision)
    }

    pub fn choose(&mut self, directory: PathBuf) -> Result<DirectoryChoice, String> {
        let directory = fs::canonicalize(directory).map_err(|e| error("无法打开所选目录", e))?;
        if !directory.is_dir() {
            return Err("请选择一个文件夹。".into());
        }
        let _lock = lock(&directory)?;
        let wallet = if directory.join(FILE_NAME).exists() {
            Some(read(&directory)?)
        } else {
            None
        };
        let choice = DirectoryChoice {
            directory: directory.to_string_lossy().into_owned(),
            has_wallet: wallet.is_some(),
            encrypted: wallet.as_ref().is_some_and(|w| encrypted(&w.payload)),
            entries: wallet
                .as_ref()
                .and_then(|w| w.payload.get("entries")?.as_array().map(Vec::len)),
        };
        self.pending = Some(directory);
        Ok(choice)
    }

    pub fn change(&mut self, mode: &str) -> Result<WalletView, String> {
        let target = self.pending.clone().ok_or("请先选择资料目录。")?;
        if target == fs::canonicalize(&self.directory).unwrap_or_else(|_| self.directory.clone()) {
            self.pending = None;
            return self.load();
        }
        let _target_lock = lock(&target)?;
        let wallet = match mode {
            "open" => read(&target)?,
            "copy" | "empty" => {
                if target.join(FILE_NAME).exists() {
                    return Err("目标目录已有资料，未覆盖。请重新选择并打开已有资料。".into());
                }
                let wallet = if mode == "copy" {
                    let _source_lock = lock(&self.directory)?;
                    read(&self.directory)?
                } else {
                    empty()
                };
                write(&target, &wallet, false)?;
                wallet
            }
            _ => return Err("不支持的目录切换方式。".into()),
        };
        fs::create_dir_all(self.config_file.parent().ok_or("设置路径无效。")?)
            .map_err(|e| error("无法保存位置设置", e))?;
        atomic_write(
            &self.config_file,
            &serde_json::to_vec(&Location {
                directory: target.clone(),
            })
            .map_err(|e| error("无法序列化位置", e))?,
            true,
        )?;
        self.directory = target;
        self.pending = None;
        Ok(self.view(wallet))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store(root: &Path) -> Store {
        Store::new(root.join("settings/location.json"), root.join("data")).unwrap()
    }
    fn payload(name: &str) -> Value {
        json!({"version":1,"entries":[{"id":"one","type":"sim","name":name}]})
    }

    #[test]
    fn write_roundtrip_and_stale_revision_preserve_data() {
        let root = tempfile::tempdir().unwrap();
        let s = store(root.path());
        assert_eq!(s.save(0, payload("本地 SIM")).unwrap(), 1);
        assert!(s.save(0, payload("旧窗口")).is_err());
        assert_eq!(
            store(root.path()).load().unwrap().payload,
            payload("本地 SIM")
        );
    }

    #[test]
    fn copy_and_reopen_custom_unicode_path_preserve_source() {
        let root = tempfile::tempdir().unwrap();
        let mut s = store(root.path());
        s.save(0, payload("资料")).unwrap();
        let destination = root.path().join("个人资料 带空格");
        fs::create_dir(&destination).unwrap();
        assert!(!s.choose(destination).unwrap().has_wallet);
        assert_eq!(s.change("copy").unwrap().payload, payload("资料"));
        assert_eq!(store(root.path()).load().unwrap().payload, payload("资料"));
        assert!(root.path().join("data").join(FILE_NAME).exists());
    }

    #[test]
    fn existing_wallet_is_never_overwritten_by_copy() {
        let root = tempfile::tempdir().unwrap();
        let mut s = store(root.path());
        let other = root.path().join("other");
        fs::create_dir(&other).unwrap();
        write(
            &other,
            &WalletFile {
                payload: payload("原有资料"),
                ..empty()
            },
            false,
        )
        .unwrap();
        assert!(s.choose(other).unwrap().has_wallet);
        assert!(s.change("copy").is_err());
        assert_eq!(s.change("open").unwrap().payload, payload("原有资料"));
    }

    #[test]
    fn corrupt_or_missing_configured_wallet_never_becomes_empty() {
        let root = tempfile::tempdir().unwrap();
        let s = store(root.path());
        fs::write(s.directory.join(FILE_NAME), "broken").unwrap();
        assert!(s.load().is_err());
        assert!(s.save(0, payload("new")).is_err());
        assert_eq!(
            fs::read_to_string(s.directory.join(FILE_NAME)).unwrap(),
            "broken"
        );
    }

    #[test]
    fn encrypted_payload_stays_opaque_and_cannot_be_downgraded() {
        let root = tempfile::tempdir().unwrap();
        let s = store(root.path());
        let encrypted = json!({"format":"mrgcard-encrypted","version":1,"iterations":600000,"salt":"AAAAAAAAAAAAAAAAAAAAAA==","iv":"AAAAAAAAAAAAAAAA","data":"AAAAAAAAAAAAAAAAAAAAAA=="});
        s.save(0, encrypted.clone()).unwrap();
        assert_eq!(s.load().unwrap().payload, encrypted);
        assert!(s.save(1, payload("plaintext")).is_err());
    }

    #[test]
    fn active_file_lock_rejects_second_writer() {
        let root = tempfile::tempdir().unwrap();
        let s = store(root.path());
        let _lock = lock(&s.directory).unwrap();
        assert!(s.save(0, payload("new")).is_err());
    }

    #[test]
    fn stale_directory_cannot_write_to_new_location() {
        let root = tempfile::tempdir().unwrap();
        let mut s = store(root.path());
        let original = s.directory.to_string_lossy().into_owned();
        let destination = root.path().join("moved");
        fs::create_dir(&destination).unwrap();
        s.choose(destination).unwrap();
        s.change("copy").unwrap();
        assert!(s.check_directory(&original).is_err());
        assert!(s
            .check_directory(s.directory.to_string_lossy().as_ref())
            .is_ok());
    }

    #[test]
    fn missing_custom_drive_does_not_fall_back_to_empty_default() {
        let root = tempfile::tempdir().unwrap();
        let mut s = store(root.path());
        let destination = root.path().join("external");
        fs::create_dir(&destination).unwrap();
        s.choose(destination.clone()).unwrap();
        s.change("copy").unwrap();
        fs::remove_file(destination.join(FILE_NAME)).unwrap();
        let reopened = store(root.path());
        assert!(reopened.load().is_err());
        assert!(!destination.join(FILE_NAME).exists());
    }

    #[test]
    fn backup_cannot_replace_storage_files_using_windows_name_aliases() {
        assert!(reserved_backup_name(Path::new("FOLIO.WALLET.JSON")));
        assert!(reserved_backup_name(Path::new("storage-location.json. ")));
        assert!(reserved_backup_name(Path::new(".FOLIO.LOCK")));
        assert!(!reserved_backup_name(Path::new(
            "folio-2026-10-18-encrypted.json"
        )));
    }
}
