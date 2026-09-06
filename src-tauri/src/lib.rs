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

#[tauri::command]
fn save_project_file(path: String, content: String) -> Result<(), String> {
    let path = std::path::Path::new(&path);
    if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("beblogcam")) != Some(true) {
        return Err("BeBlog CAM speichert Projekte ausschließlich als .beblogcam-Datei.".into());
    }
    std::fs::write(path, content.as_bytes())
        .map_err(|error| format!("Projektdatei konnte nicht gespeichert werden: {error}"))
}

#[tauri::command]
fn load_project_file(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("beblogcam")) != Some(true) {
        return Err("BeBlog CAM lädt Projekte ausschließlich aus .beblogcam-Dateien.".into());
    }
    std::fs::read_to_string(path)
        .map_err(|error| format!("Projektdatei konnte nicht gelesen werden: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![inspect_import, new_project, save_nc_file, save_project_file, load_project_file])
        .run(tauri::generate_context!())
        .expect("error while running BeBlog CAM");
}
