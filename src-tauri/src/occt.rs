use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrepSummary {
    pub backend: String,
    pub native_brep: bool,
    pub faces: usize,
    pub edges: usize,
    pub vertices: usize,
    pub solids: usize,
    pub surface_types: Vec<SurfaceTypeSummary>,
    #[serde(default)]
    pub cylinder_radii_mm: Vec<f64>,
    #[serde(default)]
    pub manufacturing_faces: Vec<ManufacturingFaceSummary>,
    #[serde(default)]
    pub manufacturing_edges: Vec<ManufacturingEdgeSummary>,
    #[serde(default)]
    pub manufacturing_wires: Vec<ManufacturingWireSummary>,
    #[serde(default)]
    pub display_triangles: usize,
    #[serde(default)]
    pub display_vertices: Vec<f64>,
    #[serde(default)]
    pub display_face_ids: Vec<usize>,
    #[serde(default)]
    pub display_edges: Vec<Vec<f64>>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceTypeSummary { pub kind: String, pub count: usize }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManufacturingFaceSummary {
    pub face_id: usize,
    pub kind: String,
    pub orientation: String,
    #[serde(default)] pub origin: Option<[f64; 3]>,
    #[serde(default)] pub normal: Option<[f64; 3]>,
    #[serde(default)] pub axis_origin: Option<[f64; 3]>,
    #[serde(default)] pub axis_direction: Option<[f64; 3]>,
    #[serde(default)] pub radius_mm: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManufacturingEdgeSummary {
    pub edge_id: usize,
    pub kind: String,
    pub orientation: String,
    pub start: [f64; 3],
    pub end: [f64; 3],
    #[serde(default)] pub center: Option<[f64; 3]>,
    #[serde(default)] pub axis_direction: Option<[f64; 3]>,
    #[serde(default)] pub radius_mm: Option<f64>,
    pub closed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManufacturingWireSummary {
    pub wire_id: usize,
    pub face_id: usize,
    pub orientation: String,
    pub closed: bool,
    pub edge_ids: Vec<usize>,
}

pub trait BrepBackend { fn inspect_step(&self, path: &Path) -> Result<BrepSummary, String>; }
pub struct Occt8Backend;

#[cfg(feature = "occt-native")]
mod native {
    use super::BrepSummary;
    use serde::Deserialize;
    use std::ffi::{c_char, CStr, CString};
    use std::path::Path;
    unsafe extern "C" { fn beblog_occt_inspect_step(path: *const c_char) -> *mut c_char; fn beblog_occt_free_string(value: *mut c_char); }
    #[derive(Deserialize)] struct NativeError { error: String }
    pub fn inspect(path: &Path) -> Result<BrepSummary, String> {
        let path = path.to_str().ok_or("STEP-Pfad ist nicht als UTF-8 darstellbar")?;
        let path = CString::new(path).map_err(|_| "STEP-Pfad enthält ein ungültiges Nullbyte")?;
        let raw = unsafe { beblog_occt_inspect_step(path.as_ptr()) };
        if raw.is_null() { return Err("OCCT-Bridge konnte kein Ergebnis reservieren".into()); }
        let text = unsafe { CStr::from_ptr(raw) }.to_string_lossy().into_owned();
        unsafe { beblog_occt_free_string(raw) }
        if let Ok(error) = serde_json::from_str::<NativeError>(&text) { return Err(error.error); }
        serde_json::from_str::<BrepSummary>(&text).map_err(|e| format!("OCCT-Bridge lieferte ungültige Geometriedaten: {e}"))
    }
}

impl BrepBackend for Occt8Backend {
    fn inspect_step(&self, path: &Path) -> Result<BrepSummary, String> {
        #[cfg(feature = "occt-native")] { return native::inspect(path); }
        #[cfg(not(feature = "occt-native"))] { let _ = path; Err("Native OCCT-Unterstützung ist in diesem Build nicht aktiviert. Für STEP/BRep mit Feature `occt-native` und OCCT 8 bauen.".into()) }
    }
}

#[cfg(all(test, feature = "occt-native"))]
mod tests {
    use super::{BrepBackend, Occt8Backend};
    use std::{env, path::Path};
    #[test]
    fn loads_real_step_as_brep() {
        let fixture = env::var("BEBLOG_OCCT_TEST_STEP").expect("BEBLOG_OCCT_TEST_STEP must point to a real STEP fixture");
        let summary = Occt8Backend.inspect_step(Path::new(&fixture)).expect("native OCCT STEP import must succeed");
        assert!(summary.native_brep);
        assert!(summary.faces > 0 && summary.edges > 0);
        assert_eq!(summary.manufacturing_faces.len(), summary.faces);
        assert_eq!(summary.manufacturing_edges.len(), summary.edges);
        assert!(summary.manufacturing_faces.iter().enumerate().all(|(id, face)| face.face_id == id));
        assert!(summary.manufacturing_edges.iter().enumerate().all(|(id, edge)| edge.edge_id == id));
        assert!(summary.manufacturing_wires.iter().all(|wire| wire.face_id < summary.faces && !wire.edge_ids.is_empty() && wire.edge_ids.iter().all(|id| *id < summary.edges)));
        assert!(summary.manufacturing_faces.iter().filter(|f| f.kind == "plane").all(|f| f.origin.is_some() && f.normal.is_some()));
        assert!(summary.manufacturing_faces.iter().filter(|f| f.kind == "cylinder").all(|f| f.axis_origin.is_some() && f.axis_direction.is_some() && f.radius_mm.unwrap_or(0.0) > 0.0));
        assert!(summary.display_triangles > 0);
        assert_eq!(summary.display_vertices.len(), summary.display_triangles * 9);
        assert_eq!(summary.display_face_ids.len(), summary.display_triangles);
        assert!(!summary.display_edges.is_empty());
    }
}
