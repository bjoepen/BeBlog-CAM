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

    let mut project:serde_json::Value=serde_json::from_str(&content)
        .map_err(|error|format!("Projektdatei konnte vor dem Speichern nicht validiert werden: {error}"))?;
    let source_path=project.get("source").and_then(|source|source.get("path")).and_then(|value|value.as_str())
        .ok_or_else(||"Projektdatei enthält keine gültige Quelldatei-Referenz.".to_string())?;
    let fingerprint=import::source_fingerprint(std::path::Path::new(source_path))?;
    let source=project.get_mut("source").and_then(|value|value.as_object_mut())
        .ok_or_else(||"Projektdatei enthält keine gültige Quelldatei-Referenz.".to_string())?;
    source.insert("geometryIdentity".into(),serde_json::Value::String(fingerprint));
    let mut encoded=serde_json::to_string_pretty(&project)
        .map_err(|error|format!("Projektdatei konnte nicht serialisiert werden: {error}"))?;
    encoded.push('\n');

    std::fs::write(path, encoded.as_bytes())
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
