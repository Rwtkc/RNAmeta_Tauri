// src-tauri/src/lib.rs

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

mod secure_scripts {
    include!(concat!(env!("OUT_DIR"), "/secure_scripts.rs"));
}

fn deobfuscate(input: &[u8]) -> Vec<u8> {
    input
        .iter()
        .enumerate()
        .map(|(idx, byte)| {
            let salt = ((idx as u64).wrapping_mul(31).wrapping_add(17) & 0xff) as u8;
            byte ^ secure_scripts::SCRIPT_KEY[idx % secure_scripts::SCRIPT_KEY.len()] ^ salt
        })
        .collect()
}

#[tauri::command]
fn prepare_secure_script(app: tauri::AppHandle, script_id: String) -> Result<String, String> {
    let blob = secure_scripts::get_script_blob(&script_id)
        .ok_or_else(|| format!("Unknown script id: {script_id}"))?;
    let script_bytes = deobfuscate(blob);

    let base_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let scripts_dir = base_dir.join("secure-scripts");
    fs::create_dir_all(&scripts_dir).map_err(|e| e.to_string())?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let pid = std::process::id();
    let script_path = scripts_dir.join(format!("{script_id}_{pid}_{now}.R"));

    fs::write(&script_path, script_bytes).map_err(|e| e.to_string())?;
    Ok(script_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn cleanup_secure_script(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }

    let script_path = PathBuf::from(path);
    if script_path.exists() {
        fs::remove_file(script_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            prepare_secure_script,
            cleanup_secure_script
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
