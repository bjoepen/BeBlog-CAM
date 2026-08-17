use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transform3 {
    pub translation: [f64; 3],
    pub rotation_deg: [f64; 3],
}

impl Default for Transform3 {
    fn default() -> Self {
        Self { translation: [0.0; 3], rotation_deg: [0.0; 3] }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part {
    pub source_path: String,
    pub source_kind: String,
    pub transform_in_stock: Transform3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stock {
    pub size_mm: [f64; 3],
    pub origin: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkCoordinateSystem {
    pub stock_to_machine: Transform3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineSetup {
    pub controller: String,
    pub probe_plate: Option<ProbePlate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbePlate {
    pub thickness_mm: f64,
    pub coarse_feed_mm_min: f64,
    pub fine_feed_mm_min: f64,
    pub retract_mm: f64,
    pub max_travel_mm: f64,
    pub safety_clearance_mm: f64,
    pub normally_open: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub part: Option<Part>,
    pub stock: Stock,
    pub wcs: WorkCoordinateSystem,
    pub machine: MachineSetup,
}

impl Default for Project {
    fn default() -> Self {
        Self {
            part: None,
            stock: Stock { size_mm: [200.0, 80.0, 22.0], origin: [0.0; 3] },
            wcs: WorkCoordinateSystem { stock_to_machine: Transform3::default() },
            machine: MachineSetup { controller: "linuxcnc".into(), probe_plate: None },
        }
    }
}
