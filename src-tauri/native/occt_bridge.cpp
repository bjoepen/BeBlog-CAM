#include "occt_bridge.h"
#include <BRepAdaptor_Curve.hxx>
#include <BRepBuilderAPI_Transform.hxx>
#include <BRepAlgoAPI_Section.hxx>
#include <BRepTools_WireExplorer.hxx>
#include <BRep_Builder.hxx>
#include <Geom_Plane.hxx>
#include <TopoDS_Compound.hxx>
#include <gp_Ax1.hxx>
#include <gp_Ax2.hxx>
#include <gp_Dir.hxx>
#include <gp_Pln.hxx>
#include <gp_Trsf.hxx>
#include <gp_Vec.hxx>
#include <algorithm>
#include <cctype>
#include <limits>
#include <regex>
#include <vector>
#include <BRepAdaptor_Surface.hxx>
#include <BRepMesh_IncrementalMesh.hxx>
#include <BRep_Tool.hxx>
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
void append_manufacturing_edge(std::ostringstream& out,const TopoDS_Edge& edge,std::size_t id,bool& first){BRepAdaptor_Curve c(edge);double a=c.FirstParameter(),b=c.LastParameter();if(!first)out<<',';out<<"{\"edgeId\":"<<id<<",\"kind\":\""<<curve_name(c.GetType())<<"\",\"orientation\":\""<<orientation_name(edge.Orientation())<<"\",\"start\":";append_point3(out,c.Value(a));out<<",\"end\":";append_point3(out,c.Value(b));if(c.GetType()==GeomAbs_Circle){auto circle=c.Circle();out<<",\"center\":";append_point3(out,circle.Location());out<<",\"axisDirection\":";append_dir3(out,circle.Axis().Direction());out<<",\"radiusMm\":"<<std::setprecision(12)<<circle.Radius();}out<<",\"closed\":"<<(edge.Closed()?"true":"false")<<'}';first=false;}
void append_display_edge(std::ostringstream& out,const TopoDS_Edge& edge,bool& first_edge){BRepAdaptor_Curve c(edge);double a=c.FirstParameter(),b=c.LastParameter();if(!std::isfinite(a)||!std::isfinite(b)||b<a)return;int samples=c.GetType()==GeomAbs_Line?2:33;if(!first_edge)out<<',';out<<'[';bool fp=true;for(int i=0;i<samples;++i){double t=a+(b-a)*static_cast<double>(i)/static_cast<double>(samples-1);append_point(out,c.Value(t),fp);}out<<']';first_edge=false;}

std::string json_string_field(const std::string& json,const char* key){
 const std::regex re(std::string("\"")+key+"\"\\s*:\\s*\"([^\"]*)\"");
 std::smatch m;if(!std::regex_search(json,m,re))return {};return m[1].str();
}
double json_number_field(const std::string& json,const char* key,double fallback=0){
 const std::regex re(std::string("\"")+key+"\"\\s*:\\s*(-?[0-9]+(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)");
 std::smatch m;if(!std::regex_search(json,m,re))return fallback;try{return std::stod(m[1].str());}catch(...){return fallback;}
}
std::vector<double> json_number_array(const std::string& json,const char* key){
 const std::regex re(std::string("\"")+key+"\"\\s*:\\s*\\[([^\\]]*)\\]");
 std::smatch m;std::vector<double> values;if(!std::regex_search(json,m,re))return values;
 std::stringstream ss(m[1].str());std::string token;while(std::getline(ss,token,',')){try{values.push_back(std::stod(token));}catch(...){}}
 return values;
}
std::vector<std::size_t> json_size_array(const std::string& json,const char* key){
 std::vector<std::size_t> out;for(double value:json_number_array(json,key))if(value>=0&&std::floor(value)==value)out.push_back(static_cast<std::size_t>(value));return out;
}
void append_json_string(std::ostringstream& out,const std::string& value){out<<'"';for(char c:value){if(c=='"'||c=='\\')out<<'\\';out<<c;}out<<'"';}
TopoDS_Shape transform_shape(const TopoDS_Shape& source,const std::string& json){
 gp_Trsf total;
 auto apply_rotation=[&](double degrees,const gp_Dir& axis){if(std::abs(degrees)<=1e-12)return;gp_Trsf r;r.SetRotation(gp_Ax1(gp_Pnt(0,0,0),axis),degrees*M_PI/180.0);total.Multiply(r);};
 apply_rotation(json_number_field(json,"rotationXDeg"),gp_Dir(1,0,0));
 apply_rotation(json_number_field(json,"rotationYDeg"),gp_Dir(0,1,0));
 apply_rotation(json_number_field(json,"rotationZDeg"),gp_Dir(0,0,1));
 const auto t=json_number_array(json,"translationMm");if(t.size()==3){gp_Trsf tr;tr.SetTranslation(gp_Vec(t[0],t[1],t[2]));total.Multiply(tr);}
 return BRepBuilderAPI_Transform(source,total,true).Shape();
}
struct SectionChain{std::vector<gp_Pnt> points;};
double d2xy(const gp_Pnt&a,const gp_Pnt&b){const double dx=a.X()-b.X(),dy=a.Y()-b.Y();return dx*dx+dy*dy;}
std::vector<SectionChain> section_chains(const TopoDS_Shape& selected,double z){
 Handle(Geom_Plane) plane=new Geom_Plane(gp_Pln(gp_Pnt(0,0,z),gp_Dir(0,0,1)));
 BRepAlgoAPI_Section section(selected,plane,false);section.ComputePCurveOn1(false);section.Approximation(true);section.Build();
 std::vector<std::pair<gp_Pnt,gp_Pnt>> segments;
 if(!section.IsDone())return {};
 for(TopExp_Explorer it(section.Shape(),TopAbs_EDGE);it.More();it.Next()){
  BRepAdaptor_Curve c(TopoDS::Edge(it.Current()));double a=c.FirstParameter(),b=c.LastParameter();if(!std::isfinite(a)||!std::isfinite(b))continue;
  int samples=c.GetType()==GeomAbs_Line?2:65;gp_Pnt prev=c.Value(a);
  for(int i=1;i<samples;++i){double t=a+(b-a)*double(i)/double(samples-1);gp_Pnt next=c.Value(t);if(d2xy(prev,next)>1e-16)segments.push_back({prev,next});prev=next;}
 }
 std::vector<SectionChain> chains;const double tol2=1e-10;
 while(!segments.empty()){SectionChain chain;chain.points={segments.back().first,segments.back().second};segments.pop_back();bool grew=true;
  while(grew){grew=false;for(auto it=segments.begin();it!=segments.end();++it){auto&front=chain.points.front();auto&back=chain.points.back();
   if(d2xy(back,it->first)<tol2){chain.points.push_back(it->second);}
   else if(d2xy(back,it->second)<tol2){chain.points.push_back(it->first);}
   else if(d2xy(front,it->second)<tol2){chain.points.insert(chain.points.begin(),it->first);}
   else if(d2xy(front,it->first)<tol2){chain.points.insert(chain.points.begin(),it->second);}
   else continue;segments.erase(it);grew=true;break;
  }}
  chains.push_back(std::move(chain));
 }
 return chains;
}
}

extern "C" char* beblog_occt_inspect_step(const char* path){try{
 if(!path||!*path)return copy_result("{\"error\":\"Leerer STEP-Pfad\"}");STEPControl_Reader reader;if(reader.ReadFile(path)!=IFSelect_RetDone)return copy_result("{\"error\":\"STEP-Datei konnte von OCCT nicht gelesen werden\"}");if(reader.TransferRoots()<=0)return copy_result("{\"error\":\"STEP-Datei enthält keine übertragbare BRep-Geometrie\"}");TopoDS_Shape shape=reader.OneShape();if(shape.IsNull())return copy_result("{\"error\":\"OCCT lieferte eine leere Shape\"}");
 const auto solids=count_subshapes(shape,TopAbs_SOLID),faces=count_subshapes(shape,TopAbs_FACE),vertices=count_subshapes(shape,TopAbs_VERTEX);
 TopTools_IndexedMapOfShape edge_map;TopExp::MapShapes(shape,TopAbs_EDGE,edge_map);const auto edges=static_cast<std::size_t>(edge_map.Extent());
 std::size_t planes=0,cylinders=0,cones=0,spheres=0,tori=0,other=0;std::ostringstream radii,mfaces,medges,mwires;bool fr=true,ff=true,fe=true,fw=true;std::size_t face_id=0,wire_id=0;
 for(TopExp_Explorer it(shape,TopAbs_FACE);it.More();it.Next(),++face_id){auto face=TopoDS::Face(it.Current());BRepAdaptor_Surface s(face,true);switch(s.GetType()){case GeomAbs_Plane:++planes;break;case GeomAbs_Cylinder:++cylinders;if(!fr)radii<<',';radii<<std::setprecision(12)<<s.Cylinder().Radius();fr=false;break;case GeomAbs_Cone:++cones;break;case GeomAbs_Sphere:++spheres;break;case GeomAbs_Torus:++tori;break;default:++other;break;}append_manufacturing_face(mfaces,face,face_id,ff);
   for(TopExp_Explorer wit(face,TopAbs_WIRE);wit.More();wit.Next(),++wire_id){auto wire=TopoDS::Wire(wit.Current());if(!fw)mwires<<',';mwires<<"{\"wireId\":"<<wire_id<<",\"faceId\":"<<face_id<<",\"orientation\":\""<<orientation_name(wire.Orientation())<<"\",\"closed\":"<<(wire.Closed()?"true":"false")<<",\"edgeIds\":[";bool first_id=true;for(TopExp_Explorer eit(wire,TopAbs_EDGE);eit.More();eit.Next()){int idx=edge_map.FindIndex(eit.Current());if(idx<=0)continue;if(!first_id)mwires<<',';mwires<<(idx-1);first_id=false;}mwires<<"]}";fw=false;}}
 for(int i=1;i<=edge_map.Extent();++i)append_manufacturing_edge(medges,TopoDS::Edge(edge_map(i)),static_cast<std::size_t>(i-1),fe);
 BRepMesh_IncrementalMesh mesher(shape,0.1,false,0.5,true);std::size_t triangles=0;std::ostringstream mesh_vertices,mesh_face_ids;bool fv=true,ffi=true;if(mesher.IsDone()){std::size_t fid=0;for(TopExp_Explorer it(shape,TopAbs_FACE);it.More();it.Next(),++fid){TopLoc_Location loc;auto tri=BRep_Tool::Triangulation(TopoDS::Face(it.Current()),loc);if(tri.IsNull())continue;triangles+=tri->NbTriangles();auto tr=loc.Transformation();for(int i=1;i<=tri->NbTriangles();++i){int n1=0,n2=0,n3=0;tri->Triangle(i).Get(n1,n2,n3);append_point(mesh_vertices,tri->Node(n1).Transformed(tr),fv);append_point(mesh_vertices,tri->Node(n2).Transformed(tr),fv);append_point(mesh_vertices,tri->Node(n3).Transformed(tr),fv);if(!ffi)mesh_face_ids<<',';mesh_face_ids<<fid;ffi=false;}}}
 std::ostringstream display_edges;bool fde=true;for(int i=1;i<=edge_map.Extent();++i)append_display_edge(display_edges,TopoDS::Edge(edge_map(i)),fde);
 std::ostringstream out;out<<"{\"backend\":\"OCCT 8 / native C++ bridge\",\"nativeBrep\":true,\"faces\":"<<faces<<",\"edges\":"<<edges<<",\"vertices\":"<<vertices<<",\"solids\":"<<solids<<",\"surfaceTypes\":[{\"kind\":\"plane\",\"count\":"<<planes<<"},{\"kind\":\"cylinder\",\"count\":"<<cylinders<<"},{\"kind\":\"cone\",\"count\":"<<cones<<"},{\"kind\":\"sphere\",\"count\":"<<spheres<<"},{\"kind\":\"torus\",\"count\":"<<tori<<"},{\"kind\":\"other\",\"count\":"<<other<<"}],\"cylinderRadiiMm\":["<<radii.str()<<"],\"manufacturingFaces\":["<<mfaces.str()<<"],\"manufacturingEdges\":["<<medges.str()<<"],\"manufacturingWires\":["<<mwires.str()<<"],\"displayTriangles\":"<<triangles<<",\"displayVertices\":["<<mesh_vertices.str()<<"],\"displayFaceIds\":["<<mesh_face_ids.str()<<"],\"displayEdges\":["<<display_edges.str()<<"],\"note\":\"Exaktes BRep bleibt Source of Truth. Manufacturing Faces, Edges und Wires exportieren analytische CAM-Semantik; Display-Geometrie bleibt rein visuell.\"}";return copy_result(out.str());
 }catch(...){return copy_result("{\"error\":\"OCCT-Fehler beim STEP-Import\"}");}}


extern "C" char* beblog_occt_build_zlevel_regions(const char* request_json){try{
 if(!request_json||!*request_json)return copy_result("{\"error\":\"Leere native Z-Level-Anfrage\"}");
 const std::string request(request_json);
 if(json_string_field(request,"contractVersion")!="008H-N1-v1")return copy_result("{\"error\":\"Unbekannte Native-Z-Level-Contract-Version\"}");
 const std::string path=json_string_field(request,"sourcePath"),fingerprint=json_string_field(request,"sourceFingerprint");
 if(path.empty()||fingerprint.empty())return copy_result("{\"error\":\"Native Z-Level-Anfrage benötigt sourcePath und sourceFingerprint\"}");
 const auto face_ids=json_size_array(request,"faceIds"),levels=json_number_array(request,"zLevelsMm");
 if(face_ids.empty()||levels.empty())return copy_result("{\"error\":\"Native Z-Level-Anfrage benötigt Face-IDs und Z-Level\"}");
 STEPControl_Reader reader;if(reader.ReadFile(path.c_str())!=IFSelect_RetDone)return copy_result("{\"error\":\"STEP-Datei konnte von OCCT nicht gelesen werden\"}");
 if(reader.TransferRoots()<=0)return copy_result("{\"error\":\"STEP-Datei enthält keine übertragbare BRep-Geometrie\"}");
 TopoDS_Shape source=reader.OneShape();if(source.IsNull())return copy_result("{\"error\":\"OCCT lieferte eine leere Shape\"}");
 std::vector<TopoDS_Face> faces;for(TopExp_Explorer it(source,TopAbs_FACE);it.More();it.Next())faces.push_back(TopoDS::Face(it.Current()));
 BRep_Builder builder;TopoDS_Compound selected;builder.MakeCompound(selected);
 for(auto id:face_ids){if(id>=faces.size())return copy_result("{\"error\":\"Native Z-Level-Anfrage enthält eine ungültige Face-ID\"}");builder.Add(selected,faces[id]);}
 const TopoDS_Shape transformed=transform_shape(selected,request);
 std::ostringstream out;out<<"{\"contractVersion\":\"008H-N1-v1\",\"sourceFingerprint\":";append_json_string(out,fingerprint);
 out<<",\"faceIdContract\":\"zero-based TopExp_Explorer(shape, TopAbs_FACE) order; identical to manufacturingFaces.faceId and displayFaceIds\",\"regions\":[";
 bool first_region=true;
 for(double z:levels){if(!first_region)out<<',';first_region=false;auto chains=section_chains(transformed,z);
  out<<"{\"z\":"<<std::setprecision(12)<<z<<",\"valid\":"<<(!chains.empty()?"true":"false")<<",\"islands\":[";
  bool first_island=true;for(const auto& chain:chains){if(chain.points.size()<2)continue;if(!first_island)out<<',';first_island=false;
   // N2 first executable kernel: exact OCCT Face/plane section, represented as
   // bounded section loops/polylines. Closed planar material booleans are the
   // next N2 increment; open sections fail closed instead of inventing ownership.
   const bool closed=d2xy(chain.points.front(),chain.points.back())<1e-10;
   if(!closed)continue;
   out<<"{\"outer\":[";bool fp=true;for(const auto&p:chain.points){if(!fp)out<<',';out<<"{\"x\":"<<std::setprecision(12)<<p.X()<<",\"y\":"<<p.Y()<<'}';fp=false;}out<<"],\"holes\":[]}";
  }
  out<<"],\"errors\":[";
  bool any_closed=false;for(const auto&c:chains)if(c.points.size()>2&&d2xy(c.points.front(),c.points.back())<1e-10){any_closed=true;break;}
  if(!any_closed)out<<"\"OCCT Face/Z section did not form a closed planar region; fail-closed\"";
  out<<"],\"warnings\":[]}";
 }
 out<<"],\"errors\":[],\"warnings\":[\"008H-N2 native OCCT Face/Z section kernel active; no display triangulation used\"]}";
 return copy_result(out.str());
 }catch(const std::exception& e){std::ostringstream out;out<<"{\"error\":\"OCCT native Z-Level error: ";append_json_string(out,e.what());out<<"\"}";return copy_result("{\"error\":\"OCCT-Fehler bei nativer Z-Level-Region\"}");}catch(...){return copy_result("{\"error\":\"OCCT-Fehler bei nativer Z-Level-Region\"}");}}

extern "C" void beblog_occt_free_string(char* value){std::free(value);}
