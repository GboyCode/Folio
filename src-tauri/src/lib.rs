mod preferences;
mod store;
mod webdav;

use preferences::{CloseBehavior, PreferenceStore, Profile};
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Mutex};
use store::{DirectoryChoice, Store, WalletView};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;

struct PreferenceState(Mutex<PreferenceStore>);

#[tauri::command]
fn load_preferences(
    app: tauri::AppHandle,
    state: State<'_, PreferenceState>,
) -> Result<Value, String> {
    let settings = state.0.lock().map_err(|_| "设置忙，请重试。")?.load()?;
    let startup = app.autolaunch().is_enabled();
    Ok(json!({
        "profile": settings.profile,
        "closeBehavior": settings.close_behavior,
        "autostart": startup.as_ref().ok(),
        "autostartError": startup.err().map(|_| "无法读取系统自启动状态，请重试。"),
        "version": app.package_info().version.to_string()
    }))
}

#[tauri::command]
fn save_profile(state: State<'_, PreferenceState>, profile: Profile) -> Result<Profile, String> {
    Ok(state
        .0
        .lock()
        .map_err(|_| "设置忙，请重试。")?
        .save_profile(profile)?
        .profile)
}

#[tauri::command]
fn set_close_behavior(
    state: State<'_, PreferenceState>,
    behavior: CloseBehavior,
) -> Result<CloseBehavior, String> {
    Ok(state
        .0
        .lock()
        .map_err(|_| "设置忙，请重试。")?
        .set_close_behavior(behavior)?
        .close_behavior)
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|_| "无法修改开机自启动，请检查系统权限后重试。")?;
    manager
        .is_enabled()
        .map_err(|_| "无法确认自启动状态，请重新打开设置。".into())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

struct LocalState {
    store: Mutex<Store>,
    startup_error: Mutex<Option<String>>,
}

#[tauri::command]
async fn load_wallet(state: State<'_, LocalState>) -> Result<WalletView, String> {
    if let Some(error) = state
        .startup_error
        .lock()
        .map_err(|_| "无法读取启动状态。")?
        .as_ref()
    {
        return Err(error.clone());
    }
    state
        .store
        .lock()
        .map_err(|_| "本地存储忙，请重试。")?
        .load()
}

#[tauri::command]
async fn save_wallet(
    state: State<'_, LocalState>,
    directory: String,
    revision: u64,
    payload: Value,
) -> Result<Value, String> {
    let store = state.store.lock().map_err(|_| "本地存储忙，请重试。")?;
    store.check_directory(&directory)?;
    let revision = store.save(revision, payload)?;
    Ok(json!({"revision":revision}))
}

#[tauri::command]
async fn choose_data_directory(
    app: tauri::AppHandle,
    state: State<'_, LocalState>,
) -> Result<Option<DirectoryChoice>, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("选择 Folio 数据文件夹")
            .blocking_pick_folder()
    })
    .await
    .map_err(|_| "文件夹选择器无法打开。")?;
    let Some(path) = selected else {
        return Ok(None);
    };
    let directory = path.into_path().map_err(|_| "请选择本机文件夹。")?;
    Ok(Some(
        state
            .store
            .lock()
            .map_err(|_| "本地存储忙，请重试。")?
            .choose(directory)?,
    ))
}

#[tauri::command]
async fn change_data_directory(
    state: State<'_, LocalState>,
    mode: String,
) -> Result<WalletView, String> {
    let boot = state
        .store
        .lock()
        .map_err(|_| "本地存储忙，请重试。")?
        .change(&mode)?;
    *state
        .startup_error
        .lock()
        .map_err(|_| "无法更新启动状态。")? = None;
    Ok(boot)
}

#[tauri::command]
async fn open_data_directory(
    app: tauri::AppHandle,
    state: State<'_, LocalState>,
) -> Result<(), String> {
    let directory = state
        .store
        .lock()
        .map_err(|_| "本地存储忙，请重试。")?
        .directory
        .clone();
    app.opener()
        .open_path(directory.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|_| "无法打开资料文件夹。".into())
}

#[tauri::command]
async fn export_backup(
    app: tauri::AppHandle,
    state: State<'_, LocalState>,
    content: String,
    filename: String,
) -> Result<bool, String> {
    if content.len() > store::MAX_BYTES + 1024
        || filename.len() > 100
        || !filename
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
    {
        return Err("备份内容或文件名无效。".into());
    }
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("导出 Folio 备份")
            .set_file_name(filename)
            .add_filter("Folio 备份", &["json"])
            .blocking_save_file()
    })
    .await
    .map_err(|_| "保存对话框无法打开。")?;
    let Some(file) = selected else {
        return Ok(false);
    };
    let path: PathBuf = file.into_path().map_err(|_| "请选择本机保存位置。")?;
    if store::reserved_backup_name(&path) {
        return Err("请选择其他文件名，不能用备份覆盖资料文件或位置设置。".into());
    }
    // Export exactly the current envelope supplied by the client; never decrypt in Rust.
    let _guard = state.store.lock().map_err(|_| "本地存储忙，请重试。")?;
    store::atomic_write(&path, content.as_bytes(), true)?;
    Ok(true)
}

#[tauri::command]
async fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|_| "网址无效。")?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none() {
        return Err("仅支持打开 http/https 网页。".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|_| "无法使用默认浏览器打开网页。".into())
}

#[tauri::command]
async fn close_app(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|_| "无法关闭窗口。".into())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Folio")
                .build(),
        )
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Visibility and decorations belong to the app, not an older saved window state.
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE - StateFlags::DECORATIONS)
                .build(),
        )
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Only keep running when the tray provides a way back in.
                    let hide_to_tray = window
                        .state::<PreferenceState>()
                        .0
                        .lock()
                        .ok()
                        .and_then(|store| store.load().ok())
                        .is_some_and(|settings| settings.close_behavior == CloseBehavior::Tray);
                    if hide_to_tray
                        && window.app_handle().tray_by_id("folio").is_some()
                        && window.hide().is_ok()
                    {
                        api.prevent_close();
                    }
                }
            }
        })
        .setup(|app| {
            app.manage(PreferenceState(Mutex::new(PreferenceStore::new(
                app.path().app_config_dir()?.join("preferences.json"),
            ))));
            let open = MenuItem::with_id(app, "open", "打开 Folio", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "退出 Folio", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &separator, &quit])?;
            TrayIconBuilder::with_id("folio")
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .ok_or("缺少 Folio 图标")?,
                )
                .tooltip("Folio · 本地版")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            let config = app.path().app_config_dir()?.join("storage-location.json");
            let directory = app.path().app_local_data_dir()?.join("data");
            let (store, error) = match Store::new(config.clone(), directory.clone()) {
                Ok(store) => (store, None),
                Err(error) => (Store::unavailable(config, directory), Some(error)),
            };
            app.manage(LocalState {
                store: Mutex::new(store),
                startup_error: Mutex::new(error),
            });
            tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?
                .initialization_script("document.addEventListener('contextmenu', event => event.preventDefault(), { capture: true });")
                .on_navigation(|url| {
                    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                        || (matches!(url.scheme(), "http" | "https")
                            && url.host_str() == Some("tauri.localhost"))
                        || (cfg!(debug_assertions)
                            && url.scheme() == "http"
                            && url.host_str() == Some("localhost")
                            && url.port() == Some(5173))
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            webdav::webdav_request,
            load_wallet,
            save_wallet,
            choose_data_directory,
            change_data_directory,
            open_data_directory,
            export_backup,
            open_external,
            close_app,
            load_preferences,
            save_profile,
            set_close_behavior,
            set_autostart,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("Folio could not start");
}
