use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Point2 {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Curve2 {
    Line { start: Point2, end: Point2 },
    Circle { center: Point2, radius: f64 },
    Arc {
        center: Point2,
        radius: f64,
        start_angle_deg: f64,
        end_angle_deg: f64,
    },
    // `bulges[i]` belongs to the segment starting at `points[i]`.
    // 0 = straight line; non-zero = exact DXF LWPOLYLINE circular arc.
    Polyline { points: Vec<Point2>, bulges: Vec<f64>, closed: bool },
    Unsupported { source_kind: String },
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanarGeometry {
    pub curves: Vec<Curve2>,
    pub bounds: Option<Bounds2>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds2 {
    pub min: Point2,
    pub max: Point2,
}

impl PlanarGeometry {
    pub fn from_curves(curves: Vec<Curve2>) -> Self {
        let mut points = Vec::new();
        for curve in &curves {
            match curve {
                Curve2::Line { start, end } => {
                    points.push(start.clone());
                    points.push(end.clone());
                }
                Curve2::Circle { center, radius } | Curve2::Arc { center, radius, .. } => {
                    points.push(Point2 { x: center.x - radius, y: center.y - radius });
                    points.push(Point2 { x: center.x + radius, y: center.y + radius });
                }
                Curve2::Polyline { points: curve_points, .. } => points.extend(curve_points.iter().cloned()),
                Curve2::Unsupported { .. } => {}
            }
        }
        let bounds = if points.is_empty() {
            None
        } else {
            let min_x = points.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
            let min_y = points.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
            let max_x = points.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
            let max_y = points.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);
            Some(Bounds2 {
                min: Point2 { x: min_x, y: min_y },
                max: Point2 { x: max_x, y: max_y },
            })
        };
        Self { curves, bounds }
    }
}
