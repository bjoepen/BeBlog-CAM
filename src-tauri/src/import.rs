use serde::Serialize;
use std::{collections::BTreeMap, path::Path};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub kind: String,
    pub file_name: String,
    pub backend: String,
    pub status: String,
    pub entities: BTreeMap<String, usize>,
    pub note: Option<String>,
}

pub fn inspect(path: &str) -> Result<ImportSummary, String> {
    let path = Path::new(path);
    let file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("Bauteil")
        .to_string();
    let ext = path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "dxf" => inspect_dxf(path, file_name),
        "step" | "stp" => Ok(ImportSummary {
            kind: "step".into(),
            file_name,
            backend: "OCCT 8 adapter".into(),
            status: "adapter-pending".into(),
            entities: BTreeMap::new(),
            note: Some("STEP ist First-Class-Import. 001A hält die native BRep-Grenze frei; die OCCT-8-Anbindung folgt ohne STL-Zwischenschritt.".into()),
        }),
        _ => Err("BeBlog CAM 001A unterstützt STEP/STP und DXF.".into()),
    }
}

fn inspect_dxf(path: &Path, file_name: String) -> Result<ImportSummary, String> {
    let drawing = dxf::Drawing::load_file(path).map_err(|e| format!("DXF konnte nicht gelesen werden: {e}"))?;
    let mut entities = BTreeMap::new();
    entities.insert("Elemente".into(), drawing.entities().count());
    entities.insert("Layer".into(), drawing.layers().count());

    Ok(ImportSummary {
        kind: "dxf".into(),
        file_name,
        backend: "dxf-rs".into(),
        status: "ready".into(),
        entities,
        note: Some("DXF bleibt planare Vektorgeometrie; die Normalisierung in BeBlog-Geometrie wird in 001B ausgebaut.".into()),
    })
}
