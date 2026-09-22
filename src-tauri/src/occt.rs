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
    #[serde(default)] pub center: Option<[f64; 3]>,
    #[serde(default)] pub x_direction: Option<[f64; 3]>,
    #[serde(default)] pub y_direction: Option<[f64; 3]>,
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
    #[serde(default)] pub degenerated: bool,
    #[serde(default)] pub degenerated_point: Option<[f64; 3]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManufacturingWireSummary {
    pub wire_id: usize,
    pub face_id: usize,
    pub orientation: String,
    pub closed: bool,
    pub edge_ids: Vec<usize>,
    #[serde(default)] pub outer: bool,
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
    fn preserves_a24_native_contract_json_fields() {
        let json = r#"{
          "backend":"OCCT 8 / native C++ bridge","nativeBrep":true,
          "faces":1,"edges":1,"vertices":1,"solids":0,
          "surfaceTypes":[{"kind":"sphere","count":1}],"cylinderRadiiMm":[],
          "manufacturingFaces":[{"faceId":0,"kind":"sphere","orientation":"forward","center":[1.0,2.0,3.0],"axisDirection":[0.0,0.0,1.0],"xDirection":[1.0,0.0,0.0],"yDirection":[0.0,1.0,0.0],"radiusMm":10.0}],
          "manufacturingEdges":[{"edgeId":0,"kind":"other","orientation":"forward","start":[1.0,2.0,13.0],"end":[1.0,2.0,13.0],"closed":true,"degenerated":true,"degeneratedPoint":[1.0,2.0,13.0]}],
          "manufacturingWires":[{"wireId":0,"faceId":0,"orientation":"forward","closed":true,"outer":true,"edgeIds":[0]}],
          "displayTriangles":0,"displayVertices":[],"displayFaceIds":[],"displayEdges":[],
          "note":"A24 transport fixture"
        }"#;
        let summary: super::BrepSummary = serde_json::from_str(json).expect("A24 native JSON must deserialize without losing manufacturing semantics");
        let sphere=&summary.manufacturing_faces[0];
        assert_eq!(sphere.center,Some([1.0,2.0,3.0]));
        assert_eq!(sphere.axis_direction,Some([0.0,0.0,1.0]));
        assert_eq!(sphere.x_direction,Some([1.0,0.0,0.0]));
        assert_eq!(sphere.y_direction,Some([0.0,1.0,0.0]));
        assert_eq!(sphere.radius_mm,Some(10.0));
        let edge=&summary.manufacturing_edges[0];
        assert!(edge.degenerated);
        assert_eq!(edge.degenerated_point,Some([1.0,2.0,13.0]));
        assert!(summary.manufacturing_wires[0].outer);
    }

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
        assert!(summary.manufacturing_faces.iter().filter(|f| f.kind == "sphere").all(|f| f.center.is_some() && f.axis_direction.is_some() && f.x_direction.is_some() && f.y_direction.is_some() && f.radius_mm.unwrap_or(0.0) > 0.0));
        assert!(summary.manufacturing_edges.iter().filter(|e| e.degenerated).all(|e| e.degenerated_point.is_some()));
        assert!(summary.display_triangles > 0);
        assert_eq!(summary.display_vertices.len(), summary.display_triangles * 9);
        assert_eq!(summary.display_face_ids.len(), summary.display_triangles);
        assert!(!summary.display_edges.is_empty());
    }
}
