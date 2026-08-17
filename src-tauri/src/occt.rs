use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrepSummary {
    pub backend: String,
    pub native_brep: bool,
    pub faces: usize,
    pub edges: usize,
    pub vertices: usize,
    pub solids: usize,
    pub surface_types: Vec<SurfaceTypeSummary>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceTypeSummary {
    pub kind: String,
    pub count: usize,
}

pub trait BrepBackend {
    fn inspect_step(&self, path: &Path) -> Result<BrepSummary, String>;
}

/// Native OCCT 8 implementation point.
///
/// 001B deliberately keeps OCCT behind this narrow boundary. The production
/// adapter must return exact BRep topology and analytic surface information;
/// tessellating STEP to STL before feature recognition is not permitted.
pub struct Occt8Backend;

impl BrepBackend for Occt8Backend {
    fn inspect_step(&self, _path: &Path) -> Result<BrepSummary, String> {
        Err("Der native OCCT-8-Adapter ist die verbleibende 001B-Systemintegration. STEP bleibt BRep-first; ein STL-Fallback wird nicht verwendet.".into())
    }
}
