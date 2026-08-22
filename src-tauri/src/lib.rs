mod domain;
mod geometry;
mod import;
mod occt;

use domain::Project;
use import::ImportSummary;

#[tauri::command]
fn inspect_import(path: String) -> Result<ImportSummary, String> {
    import::inspect(&path)
}

#[tauri::command]
fn new_project() -> Project {
    Project::default()
}

#[tauri::command]
fn save_nc_file(path: String, code: String) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("nc")) != Some(true) {
        return Err("BeBlog CAM speichert Maschinenprogramme in 001G ausschließlich als .nc-Datei.".into());
    }
    std::fs::write(path, code.as_bytes())
        .map_err(|error| format!("NC-Datei konnte nicht gespeichert werden: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![inspect_import, new_project, save_nc_file])
        .run(tauri::generate_context!())
        .expect("error while running BeBlog CAM");
}
