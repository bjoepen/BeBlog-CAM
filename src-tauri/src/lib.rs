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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![inspect_import, new_project])
        .run(tauri::generate_context!())
        .expect("error while running BeBlog CAM");
}
