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
    pub display_triangles: usize,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceTypeSummary {
    pub kind: String,
    pub count: usize,
}

pub trait BrepBackend {
    fn inspect_step(&self, path: &Path) -> Result<BrepSummary, String>;
}

pub struct Occt8Backend;

#[cfg(feature = "occt-native")]
mod native {
    use super::BrepSummary;
    use serde::Deserialize;
    use std::ffi::{c_char, CStr, CString};
    use std::path::Path;

    unsafe extern "C" {
        fn beblog_occt_inspect_step(path: *const c_char) -> *mut c_char;
        fn beblog_occt_free_string(value: *mut c_char);
    }

    #[derive(Deserialize)]
    struct NativeError {
        error: String,
    }

    pub fn inspect(path: &Path) -> Result<BrepSummary, String> {
        let path = path.to_str().ok_or("STEP-Pfad ist nicht als UTF-8 darstellbar")?;
        let path = CString::new(path).map_err(|_| "STEP-Pfad enthält ein ungültiges Nullbyte")?;
        let raw = unsafe { beblog_occt_inspect_step(path.as_ptr()) };
        if raw.is_null() {
            return Err("OCCT-Bridge konnte kein Ergebnis reservieren".into());
        }
        let text = unsafe { CStr::from_ptr(raw) }.to_string_lossy().into_owned();
        unsafe { beblog_occt_free_string(raw) };

        if let Ok(error) = serde_json::from_str::<NativeError>(&text) {
            return Err(error.error);
        }
        serde_json::from_str::<BrepSummary>(&text)
            .map_err(|e| format!("OCCT-Bridge lieferte ungültige Geometriedaten: {e}"))
    }
}

impl BrepBackend for Occt8Backend {
    fn inspect_step(&self, path: &Path) -> Result<BrepSummary, String> {
        #[cfg(feature = "occt-native")]
        {
            return native::inspect(path);
        }
        #[cfg(not(feature = "occt-native"))]
        {
            let _ = path;
            Err("Native OCCT-Unterstützung ist in diesem Build nicht aktiviert. Für STEP/BRep mit Feature `occt-native` und OCCT 8 bauen.".into())
        }
    }
}
