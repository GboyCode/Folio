use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

const MAX_AVATAR_LENGTH: usize = 400 * 1024;

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CloseBehavior {
    #[default]
    Exit,
    Tray,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub display_name: String,
    pub avatar: String,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            display_name: "本地空间".into(),
            avatar: String::new(),
        }
    }
}

impl Profile {
    pub fn validate(mut self) -> Result<Self, String> {
        self.display_name = self.display_name.trim().to_string();
        if self.display_name.is_empty()
            || self.display_name.chars().count() > 32
            || self.display_name.chars().any(char::is_control)
        {
            return Err("名称需要 1–32 个字符。".into());
        }
        if !self.avatar.is_empty() {
            let image = self
                .avatar
                .strip_prefix("data:image/png;base64,")
                .ok_or("请选择 PNG、JPEG 或 WebP 图片重新上传。")?;
            if self.avatar.len() > MAX_AVATAR_LENGTH
                || !image.starts_with("iVBORw0KGgo")
                || !image
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
            {
                return Err("头像无效或过大，请重新选择图片。".into());
            }
        }
        Ok(self)
    }
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
    pub profile: Profile,
    pub close_behavior: CloseBehavior,
}

pub struct PreferenceStore {
    path: PathBuf,
    current: Result<Preferences, String>,
}

impl PreferenceStore {
    pub fn new(path: PathBuf) -> Self {
        let current = (|| {
            let bytes = match fs::read(&path) {
                Ok(bytes) => bytes,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    return Ok(Preferences::default())
                }
                Err(_) => return Err("无法读取设置，原设置文件已保留。".into()),
            };
            if bytes.len() > MAX_AVATAR_LENGTH + 2048 {
                return Err("设置文件过大，原文件已保留。".into());
            }
            let mut preferences: Preferences =
                serde_json::from_slice(&bytes).map_err(|_| "设置文件损坏，原文件已保留。")?;
            preferences.profile = preferences.profile.validate()?;
            Ok(preferences)
        })();
        Self { path, current }
    }

    pub fn load(&self) -> Result<Preferences, String> {
        self.current.clone()
    }

    fn save(&mut self, next: Preferences) -> Result<Preferences, String> {
        self.load()?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|_| "无法创建设置目录。")?;
        }
        let bytes = serde_json::to_vec_pretty(&next).map_err(|_| "无法保存设置。")?;
        crate::store::atomic_write(&self.path, &bytes, true)?;
        self.current = Ok(next.clone());
        Ok(next)
    }

    pub fn save_profile(&mut self, profile: Profile) -> Result<Preferences, String> {
        let mut next = self.load()?;
        next.profile = profile.validate()?;
        self.save(next)
    }

    pub fn set_close_behavior(&mut self, behavior: CloseBehavior) -> Result<Preferences, String> {
        let mut next = self.load()?;
        next.close_behavior = behavior;
        self.save(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_exit_without_writing_a_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("preferences.json");
        assert_eq!(
            PreferenceStore::new(path.clone())
                .load()
                .unwrap()
                .close_behavior,
            CloseBehavior::Exit
        );
        assert!(!path.exists());
    }

    #[test]
    fn profile_and_close_behavior_survive_restart_without_overwriting_each_other() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("preferences.json");
        let mut store = PreferenceStore::new(path.clone());
        store.set_close_behavior(CloseBehavior::Tray).unwrap();
        store
            .save_profile(Profile {
                display_name: "  测试空间  ".into(),
                avatar: String::new(),
            })
            .unwrap();
        let loaded = PreferenceStore::new(path).load().unwrap();
        assert_eq!(loaded.close_behavior, CloseBehavior::Tray);
        assert_eq!(loaded.profile.display_name, "测试空间");
    }

    #[test]
    fn rejected_profile_does_not_change_saved_settings() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("preferences.json");
        let mut store = PreferenceStore::new(path.clone());
        store.set_close_behavior(CloseBehavior::Tray).unwrap();
        let before = fs::read(&path).unwrap();
        for avatar in [
            "https://example.com/avatar.png",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:image/png;base64,not-png",
        ] {
            assert!(store
                .save_profile(Profile {
                    display_name: "名字".into(),
                    avatar: avatar.into()
                })
                .is_err());
        }
        assert!(store
            .save_profile(Profile {
                display_name: " ".into(),
                avatar: String::new()
            })
            .is_err());
        assert_eq!(fs::read(path).unwrap(), before);
    }

    #[test]
    fn corrupt_settings_are_preserved() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("preferences.json");
        fs::write(&path, "broken").unwrap();
        let mut store = PreferenceStore::new(path.clone());
        assert!(store.load().is_err());
        assert!(store.set_close_behavior(CloseBehavior::Tray).is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "broken");
    }
}
