use crate::geometry::{Curve2, PlanarGeometry, Point2};
use crate::occt::{BrepBackend, BrepSummary, Occt8Backend};
use dxf::entities::EntityType;
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
    pub planar_geometry: Option<PlanarGeometry>,
    pub brep: Option<BrepSummary>,
    pub note: Option<String>,
}

pub fn inspect(path: &str) -> Result<ImportSummary, String> {
    let path = Path::new(path);
    let file_name = path.file_name().and_then(|v| v.to_str()).unwrap_or("Bauteil").to_string();
    let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "dxf" => inspect_dxf(path, file_name),
        "step" | "stp" => inspect_step(path, file_name),
        _ => Err("BeBlog CAM unterstützt STEP/STP und DXF.".into()),
    }
}

fn inspect_step(path: &Path, file_name: String) -> Result<ImportSummary, String> {
    match Occt8Backend.inspect_step(path) {
        Ok(brep) => {
            let mut entities = BTreeMap::new();
            entities.insert("Flächen".into(), brep.faces);
            entities.insert("Kanten".into(), brep.edges);
            entities.insert("Volumenkörper".into(), brep.solids);
            let note = brep.note.clone();
            let backend = brep.backend.clone();
            Ok(ImportSummary {
                kind: "step".into(), file_name, backend, status: "ready".into(), entities,
                planar_geometry: None, brep: Some(brep), note: Some(note),
            })
        }
        Err(note) => Ok(ImportSummary {
            kind: "step".into(), file_name, backend: "OCCT 8 / BRep".into(), status: "native-adapter-pending".into(),
            entities: BTreeMap::new(), planar_geometry: None, brep: None, note: Some(note),
        }),
    }
}

fn inspect_dxf(path: &Path, file_name: String) -> Result<ImportSummary, String> {
    let drawing = dxf::Drawing::load_file(path).map_err(|e| format!("DXF konnte nicht gelesen werden: {e}"))?;
    let mut counts = BTreeMap::new();
    let mut curves = Vec::new();
    let mut ignored_zero_lines = 0usize;
    for entity in drawing.entities() {
        match &entity.specific {
            EntityType::Line(line) => {
                *counts.entry("Linien".into()).or_insert(0) += 1;
                let dx = line.p2.x - line.p1.x;
                let dy = line.p2.y - line.p1.y;
                if dx.hypot(dy) <= 1e-9 {
                    ignored_zero_lines += 1;
                    continue;
                }
                curves.push(Curve2::Line { start: Point2 { x: line.p1.x, y: line.p1.y }, end: Point2 { x: line.p2.x, y: line.p2.y } });
            }
            EntityType::Circle(circle) => {
                *counts.entry("Kreise".into()).or_insert(0) += 1;
                curves.push(Curve2::Circle { center: Point2 { x: circle.center.x, y: circle.center.y }, radius: circle.radius });
            }
            EntityType::Arc(arc) => {
                *counts.entry("Bögen".into()).or_insert(0) += 1;
                curves.push(Curve2::Arc { center: Point2 { x: arc.center.x, y: arc.center.y }, radius: arc.radius, start_angle_deg: arc.start_angle, end_angle_deg: arc.end_angle });
            }
            EntityType::LwPolyline(polyline) => {
                *counts.entry("Polylinien".into()).or_insert(0) += 1;
                let points: Vec<Point2> = polyline.vertices.iter().map(|p| Point2 { x: p.x, y: p.y }).collect();
                let bulges: Vec<f64> = polyline.vertices.iter().map(|p| p.bulge).collect();
                let bulge_count = bulges.iter().filter(|b| b.abs() > 1e-12).count();
                if bulge_count > 0 {
                    *counts.entry("Polyline-Bögen".into()).or_insert(0) += bulge_count;
                }
                curves.push(Curve2::Polyline { points, closed: polyline.is_closed(), bulges });
            }
            other => {
                let source_kind = format!("{other:?}").split([' ', '{', '(']).next().unwrap_or("Entity").to_string();
                *counts.entry(format!("Weitere: {source_kind}")).or_insert(0) += 1;
            }
        }
    }
    if ignored_zero_lines > 0 {
        counts.insert("Null-Linien ignoriert".into(), ignored_zero_lines);
    }
    counts.insert("Layer".into(), drawing.layers().count());
    Ok(ImportSummary {
        kind: "dxf".into(), file_name, backend: "dxf-rs → BeBlog Geometry".into(), status: "ready".into(),
        entities: counts, planar_geometry: Some(PlanarGeometry::from_curves(curves)), brep: None,
        note: Some("DXF-Elemente wurden in das interne planare BeBlog-Geometriemodell normalisiert. Degenerierte Null-Linien werden verworfen; echte ARC- und LWPOLYLINE-Bogeninformation bleibt für die CAM-Interpolation erhalten.".into()),
    })
}
