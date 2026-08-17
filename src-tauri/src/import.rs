use crate::geometry::{Curve2, PlanarGeometry, Point2};
use crate::occt::{BrepBackend, Occt8Backend};
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
    let backend = Occt8Backend;
    match backend.inspect_step(path) {
        Ok(brep) => {
            let mut entities = BTreeMap::new();
            entities.insert("Flächen".into(), brep.faces);
            entities.insert("Kanten".into(), brep.edges);
            entities.insert("Volumenkörper".into(), brep.solids);
            Ok(ImportSummary {
                kind: "step".into(), file_name, backend: brep.backend, status: "ready".into(),
                entities, planar_geometry: None, note: Some(brep.note),
            })
        }
        Err(note) => Ok(ImportSummary {
            kind: "step".into(), file_name, backend: "OCCT 8 / BRep".into(), status: "native-adapter-pending".into(),
            entities: BTreeMap::new(), planar_geometry: None, note: Some(note),
        }),
    }
}

fn inspect_dxf(path: &Path, file_name: String) -> Result<ImportSummary, String> {
    let drawing = dxf::Drawing::load_file(path).map_err(|e| format!("DXF konnte nicht gelesen werden: {e}"))?;
    let mut counts = BTreeMap::new();
    let mut curves = Vec::new();

    for entity in drawing.entities() {
        match &entity.specific {
            EntityType::Line(line) => {
                *counts.entry("Linien".into()).or_insert(0) += 1;
                curves.push(Curve2::Line {
                    start: Point2 { x: line.p1.x, y: line.p1.y },
                    end: Point2 { x: line.p2.x, y: line.p2.y },
                });
            }
            EntityType::Circle(circle) => {
                *counts.entry("Kreise".into()).or_insert(0) += 1;
                curves.push(Curve2::Circle {
                    center: Point2 { x: circle.center.x, y: circle.center.y }, radius: circle.radius,
                });
            }
            EntityType::Arc(arc) => {
                *counts.entry("Bögen".into()).or_insert(0) += 1;
                curves.push(Curve2::Arc {
                    center: Point2 { x: arc.center.x, y: arc.center.y }, radius: arc.radius,
                    start_angle_deg: arc.start_angle, end_angle_deg: arc.end_angle,
                });
            }
            EntityType::LwPolyline(polyline) => {
                *counts.entry("Polylinien".into()).or_insert(0) += 1;
                curves.push(Curve2::Polyline {
                    points: polyline.vertices.iter().map(|p| Point2 { x: p.x, y: p.y }).collect(),
                    closed: polyline.is_closed(),
                });
            }
            other => {
                let source_kind = format!("{other:?}").split([' ', '{', '(']).next().unwrap_or("Entity").to_string();
                *counts.entry(format!("Weitere: {source_kind}")).or_insert(0) += 1;
            }
        }
    }

    counts.insert("Layer".into(), drawing.layers().count());
    let geometry = PlanarGeometry::from_curves(curves);
    Ok(ImportSummary {
        kind: "dxf".into(), file_name, backend: "dxf-rs → BeBlog Geometry".into(), status: "ready".into(),
        entities: counts, planar_geometry: Some(geometry),
        note: Some("DXF-Elemente wurden in das interne planare BeBlog-Geometriemodell normalisiert. Der CAM-Core bleibt dadurch vom DXF-Parser entkoppelt.".into()),
    })
}
