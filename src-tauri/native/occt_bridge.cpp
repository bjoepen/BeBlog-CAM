#include "occt_bridge.h"
#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRep_Tool.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Poly_Triangle.hxx>
#include <Poly_Triangulation.hxx>
#include <STEPControl_Reader.hxx>
#include <TopAbs_Orientation.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <TopExp_Explorer.hxx>
#include <TopLoc_Location.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <string>

namespace {
char* copy_result(const std::string& text) {
  auto* result = static_cast<char*>(std::malloc(text.size() + 1));
  if (!result) return nullptr;
  std::memcpy(result, text.c_str(), text.size() + 1);
  return result;
}
std::size_t count_subshapes(const TopoDS_Shape& shape, TopAbs_ShapeEnum type) {
  std::size_t count = 0;
  for (TopExp_Explorer it(shape, type); it.More(); it.Next()) ++count;
  return count;
}
void append_point(std::ostringstream& out, const gp_Pnt& point, bool& first) {
  if (!first) out << ',';
  out << std::setprecision(12) << point.X() << ',' << point.Y() << ',' << point.Z();
  first = false;
}
void append_vec3(std::ostringstream& out, double x, double y, double z) {
  out << '[' << std::setprecision(12) << x << ',' << y << ',' << z << ']';
}
void append_point3(std::ostringstream& out, const gp_Pnt& point) {
  append_vec3(out, point.X(), point.Y(), point.Z());
}
void append_dir3(std::ostringstream& out, const gp_Dir& direction) {
  append_vec3(out, direction.X(), direction.Y(), direction.Z());
}
const char* orientation_name(TopAbs_Orientation orientation) {
  switch (orientation) {
    case TopAbs_FORWARD: return "forward";
    case TopAbs_REVERSED: return "reversed";
    case TopAbs_INTERNAL: return "internal";
    case TopAbs_EXTERNAL: return "external";
    default: return "unknown";
  }
}
const char* surface_name(GeomAbs_SurfaceType type) {
  switch (type) {
    case GeomAbs_Plane: return "plane";
    case GeomAbs_Cylinder: return "cylinder";
    case GeomAbs_Cone: return "cone";
    case GeomAbs_Sphere: return "sphere";
    case GeomAbs_Torus: return "torus";
    default: return "other";
  }
}
void append_manufacturing_face(std::ostringstream& out, const TopoDS_Face& face, std::size_t face_id, bool& first_face) {
  BRepAdaptor_Surface surface(face, true);
  if (!first_face) out << ',';
  out << "{\"faceId\":" << face_id
      << ",\"kind\":\"" << surface_name(surface.GetType()) << "\""
      << ",\"orientation\":\"" << orientation_name(face.Orientation()) << "\"";
  if (surface.GetType() == GeomAbs_Plane) {
    const auto plane = surface.Plane();
    out << ",\"origin\":";
    append_point3(out, plane.Location());
    out << ",\"normal\":";
    append_dir3(out, plane.Axis().Direction());
  } else if (surface.GetType() == GeomAbs_Cylinder) {
    const auto cylinder = surface.Cylinder();
    out << ",\"axisOrigin\":";
    append_point3(out, cylinder.Location());
    out << ",\"axisDirection\":";
    append_dir3(out, cylinder.Axis().Direction());
    out << ",\"radiusMm\":" << std::setprecision(12) << cylinder.Radius();
  }
  out << '}';
  first_face = false;
}
void append_edge(std::ostringstream& out, const TopoDS_Edge& edge, bool& first_edge) {
  BRepAdaptor_Curve curve(edge);
  const double first = curve.FirstParameter();
  const double last = curve.LastParameter();
  if (!std::isfinite(first) || !std::isfinite(last) || last < first) return;
  const int samples = curve.GetType() == GeomAbs_Line ? 2 : 33;
  if (!first_edge) out << ',';
  out << '[';
  bool first_point = true;
  for (int i = 0; i < samples; ++i) {
    const double t = samples == 1 ? first : first + (last - first) * static_cast<double>(i) / static_cast<double>(samples - 1);
    append_point(out, curve.Value(t), first_point);
  }
  out << ']';
  first_edge = false;
}
}

extern "C" char* beblog_occt_inspect_step(const char* path) {
  try {
    if (!path || !*path) return copy_result("{\"error\":\"Leerer STEP-Pfad\"}");
    STEPControl_Reader reader;
    if (reader.ReadFile(path) != IFSelect_RetDone)
      return copy_result("{\"error\":\"STEP-Datei konnte von OCCT nicht gelesen werden\"}");
    if (reader.TransferRoots() <= 0)
      return copy_result("{\"error\":\"STEP-Datei enthält keine übertragbare BRep-Geometrie\"}");
    TopoDS_Shape shape = reader.OneShape();
    if (shape.IsNull()) return copy_result("{\"error\":\"OCCT lieferte eine leere Shape\"}");

    const auto solids = count_subshapes(shape, TopAbs_SOLID);
    const auto faces = count_subshapes(shape, TopAbs_FACE);
    const auto edges = count_subshapes(shape, TopAbs_EDGE);
    const auto vertices = count_subshapes(shape, TopAbs_VERTEX);
    std::size_t planes=0,cylinders=0,cones=0,spheres=0,tori=0,other=0;
    std::ostringstream radii; bool first_radius=true;
    std::ostringstream manufacturing_faces; bool first_manufacturing_face=true;
    std::size_t manufacturing_face_id=0;

    for (TopExp_Explorer it(shape, TopAbs_FACE); it.More(); it.Next(), ++manufacturing_face_id) {
      const auto face=TopoDS::Face(it.Current());
      BRepAdaptor_Surface surface(face, true);
      switch (surface.GetType()) {
        case GeomAbs_Plane: ++planes; break;
        case GeomAbs_Cylinder:
          ++cylinders;
          if (!first_radius) radii << ',';
          radii << std::setprecision(12) << surface.Cylinder().Radius();
          first_radius=false;
          break;
        case GeomAbs_Cone: ++cones; break;
        case GeomAbs_Sphere: ++spheres; break;
        case GeomAbs_Torus: ++tori; break;
        default: ++other; break;
      }
      append_manufacturing_face(manufacturing_faces, face, manufacturing_face_id, first_manufacturing_face);
    }

    BRepMesh_IncrementalMesh mesher(shape, 0.1, false, 0.5, true);
    std::size_t triangles=0;
    std::ostringstream mesh_vertices;
    std::ostringstream mesh_face_ids;
    bool first_vertex=true;
    bool first_face_id=true;
    if (mesher.IsDone()) {
      std::size_t face_id=0;
      for (TopExp_Explorer it(shape, TopAbs_FACE); it.More(); it.Next(), ++face_id) {
        TopLoc_Location location;
        auto triangulation=BRep_Tool::Triangulation(TopoDS::Face(it.Current()),location);
        if (triangulation.IsNull()) continue;
        triangles += static_cast<std::size_t>(triangulation->NbTriangles());
        const gp_Trsf transform = location.Transformation();
        for (int index=1; index<=triangulation->NbTriangles(); ++index) {
          int n1=0,n2=0,n3=0;
          triangulation->Triangle(index).Get(n1,n2,n3);
          append_point(mesh_vertices, triangulation->Node(n1).Transformed(transform), first_vertex);
          append_point(mesh_vertices, triangulation->Node(n2).Transformed(transform), first_vertex);
          append_point(mesh_vertices, triangulation->Node(n3).Transformed(transform), first_vertex);
          if (!first_face_id) mesh_face_ids << ',';
          mesh_face_ids << face_id;
          first_face_id=false;
        }
      }
    }

    std::ostringstream display_edges;
    bool first_edge=true;
    for (TopExp_Explorer it(shape, TopAbs_EDGE); it.More(); it.Next())
      append_edge(display_edges, TopoDS::Edge(it.Current()), first_edge);

    std::ostringstream out;
    out << "{\"backend\":\"OCCT 8 / native C++ bridge\",\"nativeBrep\":true"
        << ",\"faces\":"<<faces<<",\"edges\":"<<edges<<",\"vertices\":"<<vertices<<",\"solids\":"<<solids
        << ",\"surfaceTypes\":[{\"kind\":\"plane\",\"count\":"<<planes<<"},{\"kind\":\"cylinder\",\"count\":"<<cylinders
        << "},{\"kind\":\"cone\",\"count\":"<<cones<<"},{\"kind\":\"sphere\",\"count\":"<<spheres
        << "},{\"kind\":\"torus\",\"count\":"<<tori<<"},{\"kind\":\"other\",\"count\":"<<other<<"}]"
        << ",\"cylinderRadiiMm\":["<<radii.str()<<"]"
        << ",\"manufacturingFaces\":["<<manufacturing_faces.str()<<"]"
        << ",\"displayTriangles\":"<<triangles
        << ",\"displayVertices\":["<<mesh_vertices.str()<<"]"
        << ",\"displayFaceIds\":["<<mesh_face_ids.str()<<"]"
        << ",\"displayEdges\":["<<display_edges.str()<<"]"
        << ",\"note\":\"Exaktes BRep bleibt Source of Truth. Manufacturing Faces exportieren exakte analytische Flaechensemantik fuer CAM-Feature-Erkennung; Triangulation und Display-Edges dienen ausschliesslich Darstellung und Auswahl.\"}";
    return copy_result(out.str());
  } catch (...) {
    return copy_result("{\"error\":\"OCCT-Fehler beim STEP-Import\"}");
  }
}

extern "C" void beblog_occt_free_string(char* value) { std::free(value); }
