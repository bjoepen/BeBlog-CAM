#include "occt_bridge.h"
#include <BRepAdaptor_Curve.hxx>
#include <BRepAdaptor_Surface.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRep_Tool.hxx>
#include <BRepTools.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Poly_Triangle.hxx>
#include <Poly_Triangulation.hxx>
#include <STEPControl_Reader.hxx>
#include <TopAbs_Orientation.hxx>
#include <TopAbs_ShapeEnum.hxx>
#include <TopExp.hxx>
#include <TopExp_Explorer.hxx>
#include <TopLoc_Location.hxx>
#include <TopTools_IndexedMapOfShape.hxx>
#include <TopoDS.hxx>
#include <TopoDS_Edge.hxx>
#include <TopoDS_Face.hxx>
#include <TopoDS_Shape.hxx>
#include <TopoDS_Wire.hxx>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <sstream>
#include <string>

namespace {
char* copy_result(const std::string& text){auto* r=static_cast<char*>(std::malloc(text.size()+1));if(!r)return nullptr;std::memcpy(r,text.c_str(),text.size()+1);return r;}
std::size_t count_subshapes(const TopoDS_Shape& shape,TopAbs_ShapeEnum type){std::size_t n=0;for(TopExp_Explorer it(shape,type);it.More();it.Next())++n;return n;}
void append_point(std::ostringstream& out,const gp_Pnt& p,bool& first){if(!first)out<<',';out<<std::setprecision(12)<<p.X()<<','<<p.Y()<<','<<p.Z();first=false;}
void append_vec3(std::ostringstream& out,double x,double y,double z){out<<'['<<std::setprecision(12)<<x<<','<<y<<','<<z<<']';}
void append_point3(std::ostringstream& out,const gp_Pnt& p){append_vec3(out,p.X(),p.Y(),p.Z());}
void append_dir3(std::ostringstream& out,const gp_Dir& d){append_vec3(out,d.X(),d.Y(),d.Z());}
const char* orientation_name(TopAbs_Orientation o){switch(o){case TopAbs_FORWARD:return "forward";case TopAbs_REVERSED:return "reversed";case TopAbs_INTERNAL:return "internal";case TopAbs_EXTERNAL:return "external";default:return "unknown";}}
const char* surface_name(GeomAbs_SurfaceType t){switch(t){case GeomAbs_Plane:return "plane";case GeomAbs_Cylinder:return "cylinder";case GeomAbs_Cone:return "cone";case GeomAbs_Sphere:return "sphere";case GeomAbs_Torus:return "torus";default:return "other";}}
const char* curve_name(GeomAbs_CurveType t){switch(t){case GeomAbs_Line:return "line";case GeomAbs_Circle:return "circle";case GeomAbs_Ellipse:return "ellipse";case GeomAbs_Hyperbola:return "hyperbola";case GeomAbs_Parabola:return "parabola";case GeomAbs_BezierCurve:return "bezier";case GeomAbs_BSplineCurve:return "bspline";default:return "other";}}
void append_manufacturing_face(std::ostringstream& out,const TopoDS_Face& face,std::size_t id,bool& first){BRepAdaptor_Surface s(face,true);if(!first)out<<',';out<<"{\"faceId\":"<<id<<",\"kind\":\""<<surface_name(s.GetType())<<"\",\"orientation\":\""<<orientation_name(face.Orientation())<<"\"";if(s.GetType()==GeomAbs_Plane){auto p=s.Plane();out<<",\"origin\":";append_point3(out,p.Location());out<<",\"normal\":";append_dir3(out,p.Axis().Direction());}else if(s.GetType()==GeomAbs_Cylinder){auto c=s.Cylinder();out<<",\"axisOrigin\":";append_point3(out,c.Location());out<<",\"axisDirection\":";append_dir3(out,c.Axis().Direction());out<<",\"radiusMm\":"<<std::setprecision(12)<<c.Radius();}out<<'}';first=false;}
void append_manufacturing_edge(std::ostringstream& out,const TopoDS_Edge& edge,std::size_t id,bool& first){BRepAdaptor_Curve c(edge);double a=c.FirstParameter(),b=c.LastParameter();if(!first)out<<',';out<<"{\"edgeId\":"<<id<<",\"kind\":\""<<curve_name(c.GetType())<<"\",\"orientation\":\""<<orientation_name(edge.Orientation())<<"\",\"start\":";append_point3(out,c.Value(a));out<<",\"end\":";append_point3(out,c.Value(b));if(c.GetType()==GeomAbs_Circle){auto circle=c.Circle();out<<",\"center\":";append_point3(out,circle.Location());out<<",\"axisDirection\":";append_dir3(out,circle.Axis().Direction());out<<",\"radiusMm\":"<<std::setprecision(12)<<circle.Radius();}out<<",\"closed\":"<<(BRep_Tool::IsClosed(edge)?"true":"false")<<'}';first=false;}
void append_display_edge(std::ostringstream& out,const TopoDS_Edge& edge,bool& first_edge){BRepAdaptor_Curve c(edge);double a=c.FirstParameter(),b=c.LastParameter();if(!std::isfinite(a)||!std::isfinite(b)||b<a)return;int samples=c.GetType()==GeomAbs_Line?2:33;if(!first_edge)out<<',';out<<'[';bool fp=true;for(int i=0;i<samples;++i){double t=a+(b-a)*static_cast<double>(i)/static_cast<double>(samples-1);append_point(out,c.Value(t),fp);}out<<']';first_edge=false;}
}

extern "C" char* beblog_occt_inspect_step(const char* path){try{
 if(!path||!*path)return copy_result("{\"error\":\"Leerer STEP-Pfad\"}");STEPControl_Reader reader;if(reader.ReadFile(path)!=IFSelect_RetDone)return copy_result("{\"error\":\"STEP-Datei konnte von OCCT nicht gelesen werden\"}");if(reader.TransferRoots()<=0)return copy_result("{\"error\":\"STEP-Datei enthält keine übertragbare BRep-Geometrie\"}");TopoDS_Shape shape=reader.OneShape();if(shape.IsNull())return copy_result("{\"error\":\"OCCT lieferte eine leere Shape\"}");
 const auto solids=count_subshapes(shape,TopAbs_SOLID),faces=count_subshapes(shape,TopAbs_FACE),edges=count_subshapes(shape,TopAbs_EDGE),vertices=count_subshapes(shape,TopAbs_VERTEX);
 TopTools_IndexedMapOfShape edge_map;TopExp::MapShapes(shape,TopAbs_EDGE,edge_map);
 std::size_t planes=0,cylinders=0,cones=0,spheres=0,tori=0,other=0;std::ostringstream radii,mfaces,medges,mwires;bool fr=true,ff=true,fe=true,fw=true;std::size_t face_id=0,wire_id=0;
 for(TopExp_Explorer it(shape,TopAbs_FACE);it.More();it.Next(),++face_id){auto face=TopoDS::Face(it.Current());BRepAdaptor_Surface s(face,true);switch(s.GetType()){case GeomAbs_Plane:++planes;break;case GeomAbs_Cylinder:++cylinders;if(!fr)radii<<',';radii<<std::setprecision(12)<<s.Cylinder().Radius();fr=false;break;case GeomAbs_Cone:++cones;break;case GeomAbs_Sphere:++spheres;break;case GeomAbs_Torus:++tori;break;default:++other;break;}append_manufacturing_face(mfaces,face,face_id,ff);
   for(TopExp_Explorer wit(face,TopAbs_WIRE);wit.More();wit.Next(),++wire_id){auto wire=TopoDS::Wire(wit.Current());if(!fw)mwires<<',';mwires<<"{\"wireId\":"<<wire_id<<",\"faceId\":"<<face_id<<",\"orientation\":\""<<orientation_name(wire.Orientation())<<"\",\"closed\":"<<(BRepTools::IsReallyClosed(wire,face)?"true":"false")<<",\"edgeIds\":[";bool first_id=true;for(TopExp_Explorer eit(wire,TopAbs_EDGE);eit.More();eit.Next()){int idx=edge_map.FindIndex(eit.Current());if(idx<=0)continue;if(!first_id)mwires<<',';mwires<<(idx-1);first_id=false;}mwires<<"]}";fw=false;}}
 for(int i=1;i<=edge_map.Extent();++i)append_manufacturing_edge(medges,TopoDS::Edge(edge_map(i)),static_cast<std::size_t>(i-1),fe);
 BRepMesh_IncrementalMesh mesher(shape,0.1,false,0.5,true);std::size_t triangles=0;std::ostringstream mesh_vertices,mesh_face_ids;bool fv=true,ffi=true;if(mesher.IsDone()){std::size_t fid=0;for(TopExp_Explorer it(shape,TopAbs_FACE);it.More();it.Next(),++fid){TopLoc_Location loc;auto tri=BRep_Tool::Triangulation(TopoDS::Face(it.Current()),loc);if(tri.IsNull())continue;triangles+=tri->NbTriangles();auto tr=loc.Transformation();for(int i=1;i<=tri->NbTriangles();++i){int n1=0,n2=0,n3=0;tri->Triangle(i).Get(n1,n2,n3);append_point(mesh_vertices,tri->Node(n1).Transformed(tr),fv);append_point(mesh_vertices,tri->Node(n2).Transformed(tr),fv);append_point(mesh_vertices,tri->Node(n3).Transformed(tr),fv);if(!ffi)mesh_face_ids<<',';mesh_face_ids<<fid;ffi=false;}}}
 std::ostringstream display_edges;bool fde=true;for(int i=1;i<=edge_map.Extent();++i)append_display_edge(display_edges,TopoDS::Edge(edge_map(i)),fde);
 std::ostringstream out;out<<"{\"backend\":\"OCCT 8 / native C++ bridge\",\"nativeBrep\":true,\"faces\":"<<faces<<",\"edges\":"<<edges<<",\"vertices\":"<<vertices<<",\"solids\":"<<solids<<",\"surfaceTypes\":[{\"kind\":\"plane\",\"count\":"<<planes<<"},{\"kind\":\"cylinder\",\"count\":"<<cylinders<<"},{\"kind\":\"cone\",\"count\":"<<cones<<"},{\"kind\":\"sphere\",\"count\":"<<spheres<<"},{\"kind\":\"torus\",\"count\":"<<tori<<"},{\"kind\":\"other\",\"count\":"<<other<<"}],\"cylinderRadiiMm\":["<<radii.str()<<"],\"manufacturingFaces\":["<<mfaces.str()<<"],\"manufacturingEdges\":["<<medges.str()<<"],\"manufacturingWires\":["<<mwires.str()<<"],\"displayTriangles\":"<<triangles<<",\"displayVertices\":["<<mesh_vertices.str()<<"],\"displayFaceIds\":["<<mesh_face_ids.str()<<"],\"displayEdges\":["<<display_edges.str()<<"],\"note\":\"Exaktes BRep bleibt Source of Truth. Manufacturing Faces, Edges und Wires exportieren analytische CAM-Semantik; Display-Geometrie bleibt rein visuell.\"}";return copy_result(out.str());
 }catch(...){return copy_result("{\"error\":\"OCCT-Fehler beim STEP-Import\"}");}}
extern "C" void beblog_occt_free_string(char* value){std::free(value);}
