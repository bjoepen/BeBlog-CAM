#include "occt_bridge.h"
#include <BRepAdaptor_Surface.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRep_Tool.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Poly_Triangulation.hxx>
#include <STEPControl_Reader.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
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

    for (TopExp_Explorer it(shape, TopAbs_FACE); it.More(); it.Next()) {
      BRepAdaptor_Surface surface(TopoDS::Face(it.Current()), true);
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
    }

    BRepMesh_IncrementalMesh mesher(shape, 0.1, false, 0.5, true);
    std::size_t triangles=0;
    if (mesher.IsDone()) {
      for (TopExp_Explorer it(shape, TopAbs_FACE); it.More(); it.Next()) {
        TopLoc_Location location;
        auto triangulation=BRep_Tool::Triangulation(TopoDS::Face(it.Current()),location);
        if (!triangulation.IsNull()) triangles += static_cast<std::size_t>(triangulation->NbTriangles());
      }
    }

    std::ostringstream out;
    out << "{\"backend\":\"OCCT 8 / native C++ bridge\",\"nativeBrep\":true"
        << ",\"faces\":"<<faces<<",\"edges\":"<<edges<<",\"vertices\":"<<vertices<<",\"solids\":"<<solids
        << ",\"surfaceTypes\":[{\"kind\":\"plane\",\"count\":"<<planes<<"},{\"kind\":\"cylinder\",\"count\":"<<cylinders
        << "},{\"kind\":\"cone\",\"count\":"<<cones<<"},{\"kind\":\"sphere\",\"count\":"<<spheres
        << "},{\"kind\":\"torus\",\"count\":"<<tori<<"},{\"kind\":\"other\",\"count\":"<<other<<"}]"
        << ",\"cylinderRadiiMm\":["<<radii.str()<<"],\"displayTriangles\":"<<triangles
        << ",\"note\":\"Exaktes BRep bleibt Source of Truth; Triangulation dient ausschließlich der Darstellung.\"}";
    return copy_result(out.str());
  } catch (...) {
    return copy_result("{\"error\":\"OCCT-Fehler beim STEP-Import\"}");
  }
}

extern "C" void beblog_occt_free_string(char* value) { std::free(value); }
