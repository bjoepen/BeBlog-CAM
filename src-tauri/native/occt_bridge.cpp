#include "occt_bridge.h"
#include <BRepAdaptor_Curve.hxx>
#include <TopTools_ListOfShape.hxx>
#include <BRepTools.hxx>
#include <BRepBuilderAPI_MakePolygon.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepAlgoAPI_Cut.hxx>
#include <BRepAlgoAPI_Fuse.hxx>
#include <BRepProj_Projection.hxx>
#include <HLRBRep_Algo.hxx>
#include <HLRBRep_HLRToShape.hxx>
#include <HLRAlgo_Projector.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BOPAlgo_Tools.hxx>
#include <BRepAlgoAPI_Common.hxx>
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
#include <iterator>
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
 auto apply_rotation=[&](double degrees,const gp_Dir& axis){if(std::abs(degrees)<=1e-12)return;gp_Trsf r;r.SetRotation(gp_Ax1(gp_Pnt(0,0,0),axis),degrees*M_PI/180.0);total.PreMultiply(r);};
 apply_rotation(json_number_field(json,"rotationXDeg"),gp_Dir(1,0,0));
 apply_rotation(json_number_field(json,"rotationYDeg"),gp_Dir(0,1,0));
 apply_rotation(json_number_field(json,"rotationZDeg"),gp_Dir(0,0,1));
 const auto t=json_number_array(json,"translationMm");if(t.size()==3){gp_Trsf tr;tr.SetTranslation(gp_Vec(t[0],t[1],t[2]));total.PreMultiply(tr);}
 return BRepBuilderAPI_Transform(source,total,true).Shape();
}
struct SectionChain{std::vector<gp_Pnt> points;};

double d2xy(const gp_Pnt&a,const gp_Pnt&b);
std::vector<gp_Pnt> sampled_wire_xy(const TopoDS_Wire& wire,double z){
 std::vector<gp_Pnt> points;
 for(BRepTools_WireExplorer it(wire);it.More();it.Next()){
  BRepAdaptor_Curve c(it.Current());const double a=c.FirstParameter(),b=c.LastParameter();
  if(!std::isfinite(a)||!std::isfinite(b)||b<a)continue;
  const int samples=c.GetType()==GeomAbs_Line?2:65;
  for(int i=0;i<samples;++i){
   if(!points.empty()&&i==0)continue;
   const double t=a+(b-a)*static_cast<double>(i)/static_cast<double>(samples-1);
   const gp_Pnt p=c.Value(t);points.emplace_back(p.X(),p.Y(),z);
  }
 }
 if(points.size()>2&&d2xy(points.front(),points.back())>1e-12)points.push_back(points.front());
 return points;
}
TopoDS_Face stock_face(const std::string& json,double z,double margin=0){
 const double width=json_number_field(json,"width"),height=json_number_field(json,"height");
 if(!(width>0)||!(height>0))return TopoDS_Face();
 BRepBuilderAPI_MakePolygon p;p.Add(gp_Pnt(-margin,-margin,z));p.Add(gp_Pnt(width+margin,-margin,z));p.Add(gp_Pnt(width+margin,height+margin,z));p.Add(gp_Pnt(-margin,height+margin,z));p.Close();
 if(!p.IsDone())return TopoDS_Face();BRepBuilderAPI_MakeFace f(gp_Pln(gp_Pnt(0,0,z),gp_Dir(0,0,1)),p.Wire(),true);return f.IsDone()?f.Face():TopoDS_Face();
}

// 008H-N2b follows FreeCAD Adaptive manual-region semantics:
// selected BRep Faces are projected exactly onto the manufacturing plane,
// while the protected model is first clipped to the solid ABOVE the requested
// Z level and that clipped solid is projected separately. The removable target
// is selectedProjection - aboveModelProjection. Never subtract a 3D solid
// directly from a 2D Face and never infer Face ownership from display geometry.
TopoDS_Shape wires_to_planar_faces(const TopoDS_Shape& wires){
 if(wires.IsNull())return TopoDS_Shape();
 TopoDS_Shape faces;if(!BOPAlgo_Tools::WiresToFaces(wires,faces)||faces.IsNull())return TopoDS_Shape();
 return faces;
}
TopoDS_Shape project_face_wires_to_plane(const TopoDS_Face& face,const TopoDS_Face& target){
 BRep_Builder builder;TopoDS_Compound projectedWires;builder.MakeCompound(projectedWires);bool any=false;
 for(TopExp_Explorer wit(face,TopAbs_WIRE);wit.More();wit.Next()){
  const TopoDS_Wire wire=TopoDS::Wire(wit.Current());
  BRepProj_Projection projection(wire,target,gp_Dir(0,0,-1));
  if(!projection.IsDone())continue;
  for(;projection.More();projection.Next()){const TopoDS_Shape p=projection.Current();if(!p.IsNull()){builder.Add(projectedWires,p);any=true;}}
 }
 return any?wires_to_planar_faces(projectedWires):TopoDS_Shape();
}
TopoDS_Shape project_face_outline_to_plane(const TopoDS_Face& face,const TopoDS_Face& target){
 // FreeCAD projectFacesToXY does not project seam-heavy curved Face wires
 // naively. Its TechDraw.findShapeOutline path is based on exact OCCT HLR.
 // Reproduce that geometry-kernel boundary here: visible hard edges + visible
 // silhouette, seams excluded, then reconstruct the closed planar Face(s).
 occ::handle<HLRBRep_Algo> algo=new HLRBRep_Algo();
 algo->Add(face,0);
 const gp_Ax2 view(gp_Pnt(0,0,0),gp_Dir(0,0,1),gp_Dir(1,0,0));
 algo->Projector(HLRAlgo_Projector(view));
 algo->Update();
 algo->Hide();
 HLRBRep_HLRToShape result(algo);
 BRep_Builder builder;TopoDS_Compound projectedEdges;builder.MakeCompound(projectedEdges);bool any=false;
 const TopoDS_Shape hard=result.VCompound();
 const TopoDS_Shape outline=result.OutLineVCompound();
 if(!hard.IsNull()){builder.Add(projectedEdges,hard);any=true;}
 if(!outline.IsNull()){builder.Add(projectedEdges,outline);any=true;}
 if(!any)return TopoDS_Shape();
 // HLR geometry is expressed on its projection plane (Z=0). Native CAM
 // regions live on the requested manufacturing Z plane.
 BRepAdaptor_Surface targetSurface(target,true);
 if(targetSurface.GetType()!=GeomAbs_Plane)return TopoDS_Shape();
 const double targetZ=targetSurface.Plane().Location().Z();
 gp_Trsf lift;lift.SetTranslation(gp_Vec(0,0,targetZ));
 const TopoDS_Shape lifted=BRepBuilderAPI_Transform(projectedEdges,lift,true).Shape();
 TopoDS_Shape wires;
 // HLR returns an edge compound, unlike BRepProj_Projection which returns
 // projected wires. Connect the exact visible hard/outline edges first, then
 // build planar Faces. This is the OCCT equivalent of FreeCAD's edgeWalker →
 // Part.makeFace step and prevents arbitrary edge piles from being interpreted
 // as already-closed wires.
 if(BOPAlgo_Tools::EdgesToWires(lifted,wires,false)!=0||wires.IsNull())return TopoDS_Shape();
 return wires_to_planar_faces(wires);
}
TopoDS_Shape project_face_to_plane(const TopoDS_Face& face,const TopoDS_Face& target){
 BRepAdaptor_Surface surface(face,true);
 // 008H-N2d: preserve the trimmed BRep Face boundary whenever OCCT can project
 // it into a closed planar Face. This is the strongest available Face-target
 // truth and is required for concave cylindrical fillets such as the Headstock
 // Hohlkehle. HLR remains a fallback for seam/silhouette cases whose trimmed
 // boundary cannot produce a planar Face.
 const TopoDS_Shape trimmedBoundary=project_face_wires_to_plane(face,target);
 if(!trimmedBoundary.IsNull()&&count_subshapes(trimmedBoundary,TopAbs_FACE)>0)return trimmedBoundary;
 switch(surface.GetType()){
  case GeomAbs_Cylinder:
  case GeomAbs_Cone:
  case GeomAbs_Sphere:
   return project_face_outline_to_plane(face,target);
  default:
   return TopoDS_Shape();
 }
}
TopoDS_Shape fuse_planar_faces(const TopoDS_Shape& source){
 TopoDS_Shape fused;
 for(TopExp_Explorer fit(source,TopAbs_FACE);fit.More();fit.Next()){
  const TopoDS_Shape face=fit.Current();
  if(fused.IsNull()){fused=face;continue;}
  BRepAlgoAPI_Fuse op(fused,face);op.Build();if(!op.IsDone()||op.Shape().IsNull())return TopoDS_Shape();fused=op.Shape();
 }
 return fused;
}
TopoDS_Shape project_shape_to_stock_plane(const TopoDS_Shape& source,const TopoDS_Face& target){
 if(source.IsNull())return TopoDS_Shape();
 TopoDS_Shape projected;
 for(TopExp_Explorer fit(source,TopAbs_FACE);fit.More();fit.Next()){
  const TopoDS_Shape faceProjection=project_face_to_plane(TopoDS::Face(fit.Current()),target);
  if(faceProjection.IsNull())continue;
  if(projected.IsNull()){projected=faceProjection;continue;}
  BRepAlgoAPI_Fuse op(projected,faceProjection);op.Build();if(!op.IsDone()||op.Shape().IsNull())return TopoDS_Shape();projected=op.Shape();
 }
 return projected.IsNull()?TopoDS_Shape():fuse_planar_faces(projected);
}
TopoDS_Shape selected_face_projection(const TopoDS_Face& selected,const TopoDS_Face& target){
 return project_face_to_plane(selected,target);
}
struct SolidAboveProjection{TopoDS_Shape shape;bool empty=false;bool failed=false;};
SolidAboveProjection solid_above_projection(const TopoDS_Shape& fullModel,const std::string& json,double clipZ,const TopoDS_Face& target,double margin=0){
 const double width=json_number_field(json,"width"),height=json_number_field(json,"height"),top=json_number_field(json,"thickness");
 if(!(width>0)||!(height>0))return{{},false,true};
 if(!(top>clipZ+1e-9))return{{},true,false};
 const double dz=top-clipZ+1e-6;
 const TopoDS_Shape upperBox=BRepPrimAPI_MakeBox(gp_Pnt(-margin,-margin,clipZ),width+2*margin,height+2*margin,dz).Shape();
 BRepAlgoAPI_Common common(fullModel,upperBox);common.Build();if(!common.IsDone())return{{},false,true};
 if(common.Shape().IsNull()||count_subshapes(common.Shape(),TopAbs_FACE)==0)return{{},true,false};
 const TopoDS_Shape projected=project_shape_to_stock_plane(common.Shape(),target);
 if(projected.IsNull()||count_subshapes(projected,TopAbs_FACE)==0)return{{},false,true};
 return{projected,false,false};
}
struct FaceTargetRegionProbe{
 TopoDS_Shape material;
 std::string failedStage;
 std::string surfaceType;
 std::string projectionDispatch;
 std::size_t sourceWires=0;
 std::size_t closedSourceWires=0;
 std::size_t sourceEdges=0;
 std::size_t projectedShapes=0;
 std::size_t selectedProjectionFaces=0;
 std::size_t selectedInStockFaces=0;
 std::size_t aboveProjectionFaces=0;
 std::size_t materialFaces=0;
};
std::size_t planar_face_count(const TopoDS_Shape& shape){
 if(shape.IsNull())return 0;
 std::size_t count=0;for(TopExp_Explorer it(shape,TopAbs_FACE);it.More();it.Next())++count;return count;
}
FaceTargetRegionProbe face_target_material_region(const TopoDS_Face& selected,const TopoDS_Shape& fullModel,const std::string& json,double z){
 FaceTargetRegionProbe probe;
 BRepAdaptor_Surface selectedSurface(selected,true);
 probe.surfaceType=surface_name(selectedSurface.GetType());
 probe.projectionDispatch="trimmed-wires-first";
 for(TopExp_Explorer wit(selected,TopAbs_WIRE);wit.More();wit.Next()){++probe.sourceWires;const TopoDS_Wire wire=TopoDS::Wire(wit.Current());if(wire.Closed())++probe.closedSourceWires;for(TopExp_Explorer eit(wire,TopAbs_EDGE);eit.More();eit.Next())++probe.sourceEdges;}
 const TopoDS_Face stock=stock_face(json,z);if(stock.IsNull()){probe.failedStage="stock";return probe;}
 const TopoDS_Shape selectedProjection=selected_face_projection(selected,stock);
 probe.projectedShapes=selectedProjection.IsNull()?0:count_subshapes(selectedProjection,TopAbs_SHAPE);
 probe.selectedProjectionFaces=planar_face_count(selectedProjection);
 if(selectedProjection.IsNull()||probe.selectedProjectionFaces==0){probe.failedStage="selectedProjection";return probe;}
 BRepAlgoAPI_Common selectedInStock(selectedProjection,stock);selectedInStock.Build();
 if(!selectedInStock.IsDone()||selectedInStock.Shape().IsNull()){probe.failedStage="selectedInStock";return probe;}
 probe.selectedInStockFaces=planar_face_count(selectedInStock.Shape());
 if(probe.selectedInStockFaces==0){probe.failedStage="selectedInStock";return probe;}
 const SolidAboveProjection above=solid_above_projection(fullModel,json,z,stock);
 if(above.failed){probe.failedStage="solidAboveProjection";return probe;}
 probe.aboveProjectionFaces=planar_face_count(above.shape);
 if(above.empty){
  probe.material=selectedInStock.Shape();probe.materialFaces=probe.selectedInStockFaces;return probe;
 }
 BRepAlgoAPI_Cut material(selectedInStock.Shape(),above.shape);material.Build();
 if(!material.IsDone()||material.Shape().IsNull()){probe.failedStage="materialCut";return probe;}
 probe.material=material.Shape();probe.materialFaces=planar_face_count(probe.material);
 if(probe.materialFaces==0)probe.failedStage="material";
 return probe;
}
struct CutterSafetyRegion{TopoDS_Shape material;std::string failedStage;std::size_t aboveProjectionFaces=0;std::size_t materialFaces=0;};
CutterSafetyRegion cutter_safety_region(const TopoDS_Shape& fullModel,const std::string& json,double cutZ,double finishAllowance,double clearanceRadius){
 CutterSafetyRegion result;
 // Match the established 008H-E domain: raster erosion by clearanceRadius
 // still leaves one legal clearanceRadius of cutter-centre stock overhang.
 const double stockMargin=2*clearanceRadius;
 const TopoDS_Face domain=stock_face(json,cutZ,stockMargin);
 if(domain.IsNull()){result.failedStage="safetyStock";return result;}
 const double safetyZ=cutZ-finishAllowance;
 const SolidAboveProjection above=solid_above_projection(fullModel,json,safetyZ,domain,stockMargin);
 if(above.failed){result.failedStage="safetySolidAboveProjection";return result;}
 result.aboveProjectionFaces=planar_face_count(above.shape);
 if(above.empty){result.material=domain;result.materialFaces=1;return result;}
 BRepAlgoAPI_Cut safety(domain,above.shape);safety.Build();
 if(!safety.IsDone()||safety.Shape().IsNull()){result.failedStage="safetyMaterialCut";return result;}
 result.material=safety.Shape();result.materialFaces=planar_face_count(result.material);
 if(result.materialFaces==0)result.failedStage="safetyMaterial";
 return result;
}
struct PlanarIsland{SectionChain outer;std::vector<SectionChain> holes;};
std::vector<PlanarIsland> planar_shape_islands(const TopoDS_Shape& shape){
 std::vector<PlanarIsland> out;
 for(TopExp_Explorer fit(shape,TopAbs_FACE);fit.More();fit.Next()){
  const TopoDS_Face face=TopoDS::Face(fit.Current());BRepAdaptor_Surface surface(face,true);if(surface.GetType()!=GeomAbs_Plane)continue;
  const double z=surface.Plane().Location().Z();const TopoDS_Wire outerWire=BRepTools::OuterWire(face);if(outerWire.IsNull())continue;
  auto outerPoints=sampled_wire_xy(outerWire,z);if(outerPoints.size()<4)continue;
  PlanarIsland island{{std::move(outerPoints)},{}};
  for(TopExp_Explorer wit(face,TopAbs_WIRE);wit.More();wit.Next()){
   const TopoDS_Wire wire=TopoDS::Wire(wit.Current());if(wire.IsSame(outerWire))continue;
   auto holePoints=sampled_wire_xy(wire,z);if(holePoints.size()>3)island.holes.push_back({std::move(holePoints)});
  }
  out.push_back(std::move(island));
 }
 return out;
}
void append_planar_islands(std::ostringstream& out,const std::vector<PlanarIsland>& islands){
 bool firstIsland=true;
 for(const auto& island:islands){const auto& chain=island.outer;if(chain.points.size()<4||d2xy(chain.points.front(),chain.points.back())>=1e-10)continue;if(!firstIsland)out<<',';firstIsland=false;
  out<<"{\"outer\":[";bool firstPoint=true;for(const auto&p:chain.points){if(!firstPoint)out<<',';out<<"{\"x\":"<<std::setprecision(12)<<p.X()<<",\"y\":"<<p.Y()<<'}';firstPoint=false;}out<<"],\"holes\":[";
  bool firstHole=true;for(const auto& hole:island.holes){if(!firstHole)out<<',';firstHole=false;out<<'[';bool firstHolePoint=true;for(const auto&p:hole.points){if(!firstHolePoint)out<<',';out<<"{\"x\":"<<std::setprecision(12)<<p.X()<<",\"y\":"<<p.Y()<<'}';firstHolePoint=false;}out<<']';}
  out<<"]}";
 }
}

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
 if(json_string_field(request,"contractVersion")!="008H-N4-v2")return copy_result("{\"error\":\"Unbekannte Native-Z-Level-Contract-Version\"}");
 const std::string path=json_string_field(request,"sourcePath"),fingerprint=json_string_field(request,"sourceFingerprint");
 if(path.empty()||fingerprint.empty())return copy_result("{\"error\":\"Native Z-Level-Anfrage benötigt sourcePath und sourceFingerprint\"}");
 const auto face_ids=json_size_array(request,"faceIds");
 const auto levels=json_number_array(request,"zLevelsMm");
 if(face_ids.empty()||levels.empty())return copy_result("{\"error\":\"Native Z-Level-Anfrage benötigt Face-IDs und Z-Level\"}");
 const double finishAllowance=json_number_field(request,"finishAllowanceMm",-1),toolDiameter=json_number_field(request,"toolDiameterMm");
 if(finishAllowance<0||!(toolDiameter>0))return copy_result("{\"error\":\"Native Z-Level-Anfrage benötigt gültiges Werkzeug und nichtnegatives Schlichtaufmaß\"}");
 STEPControl_Reader reader;if(reader.ReadFile(path.c_str())!=IFSelect_RetDone)return copy_result("{\"error\":\"STEP-Datei konnte von OCCT nicht gelesen werden\"}");
 if(reader.TransferRoots()<=0)return copy_result("{\"error\":\"STEP-Datei enthält keine übertragbare BRep-Geometrie\"}");
 TopoDS_Shape source=reader.OneShape();if(source.IsNull())return copy_result("{\"error\":\"OCCT lieferte eine leere Shape\"}");
 std::vector<TopoDS_Face> faces;for(TopExp_Explorer it(source,TopAbs_FACE);it.More();it.Next())faces.push_back(TopoDS::Face(it.Current()));
 for(auto id:face_ids)if(id>=faces.size())return copy_result("{\"error\":\"Native Z-Level-Anfrage enthält eine ungültige Face-ID\"}");
 const TopoDS_Shape transformedModel=transform_shape(source,request);
 std::vector<TopoDS_Face> transformedFaces;transformedFaces.reserve(face_ids.size());
 for(auto id:face_ids){const TopoDS_Shape transformedFace=transform_shape(faces[id],request);if(transformedFace.IsNull()||transformedFace.ShapeType()!=TopAbs_FACE)return copy_result("{\"error\":\"Gewählte Face konnte nicht in Manufacturing-Koordinaten transformiert werden\"}");transformedFaces.push_back(TopoDS::Face(transformedFace));}
 std::ostringstream out;out<<"{\"contractVersion\":\"008H-N4-v2\",\"sourceFingerprint\":";append_json_string(out,fingerprint);
 out<<",\"faceIdContract\":\"zero-based TopExp_Explorer(shape, TopAbs_FACE) order; identical to manufacturingFaces.faceId and displayFaceIds\",\"regions\":[";
 bool first_region=true;
 for(double z:levels){if(!first_region)out<<',';first_region=false;
  std::vector<PlanarIsland> scopeIslands;std::vector<FaceTargetRegionProbe> probes;
  for(const auto& selectedFace:transformedFaces){auto probe=face_target_material_region(selectedFace,transformedModel,request,z);if(!probe.material.IsNull()){auto islands=planar_shape_islands(probe.material);scopeIslands.insert(scopeIslands.end(),std::make_move_iterator(islands.begin()),std::make_move_iterator(islands.end()));}probes.push_back(std::move(probe));}
  const CutterSafetyRegion safety=cutter_safety_region(transformedModel,request,z,finishAllowance,toolDiameter/2+finishAllowance);
  const std::vector<PlanarIsland> safetyIslands=safety.material.IsNull()?std::vector<PlanarIsland>{}:planar_shape_islands(safety.material);
  const bool scopeKernelFailed=std::any_of(probes.begin(),probes.end(),[](const FaceTargetRegionProbe& probe){return !probe.failedStage.empty()&&probe.failedStage!="material";});
  const bool valid=!scopeKernelFailed&&!scopeIslands.empty()&&safety.failedStage.empty()&&!safetyIslands.empty();
  out<<"{\"z\":"<<std::setprecision(12)<<z<<",\"valid\":"<<(valid?"true":"false")<<",\"scopeIslands\":[";append_planar_islands(out,scopeIslands);
  out<<"],\"safetyIslands\":[";append_planar_islands(out,safetyIslands);
  out<<"],\"errors\":[";
  bool first_error=true;
  if(scopeKernelFailed||scopeIslands.empty()){for(std::size_t i=0;i<probes.size();++i){const auto& probe=probes[i];if(!scopeIslands.empty()&&(probe.failedStage.empty()||probe.failedStage=="material"))continue;if(!first_error)out<<',';first_error=false;std::ostringstream detail;detail<<"OCCT Face-target stage="<<(probe.failedStage.empty()?"scopePlanarIslands":probe.failedStage)<<" faceIndex="<<i<<" surface="<<probe.surfaceType<<" dispatch="<<probe.projectionDispatch<<" sourceWires="<<probe.sourceWires<<" closedSourceWires="<<probe.closedSourceWires<<" sourceEdges="<<probe.sourceEdges<<" projectedShapes="<<probe.projectedShapes<<" selectedProjectionFaces="<<probe.selectedProjectionFaces<<" selectedInStockFaces="<<probe.selectedInStockFaces<<" aboveProjectionFaces="<<probe.aboveProjectionFaces<<" materialFaces="<<probe.materialFaces<<" islands=0; fail-closed";append_json_string(out,detail.str());}}
  if(!safety.failedStage.empty()||safetyIslands.empty()){if(!first_error)out<<',';std::ostringstream detail;detail<<"OCCT cutter-safety stage="<<(safety.failedStage.empty()?"safetyPlanarIslands":safety.failedStage)<<" aboveProjectionFaces="<<safety.aboveProjectionFaces<<" materialFaces="<<safety.materialFaces<<" islands="<<safetyIslands.size()<<"; fail-closed";append_json_string(out,detail.str());}
  out<<"],\"warnings\":[]}";
 }
 out<<"],\"errors\":[],\"warnings\":[\"008H-N4 dual native truths active: trimmed Face scope plus complete-solid cutter safety; no mixed-dimensional solid subtraction or display triangulation used\"]}";
 return copy_result(out.str());
 }catch(const std::exception& e){std::ostringstream out;out<<"{\"error\":\"OCCT native Z-Level error: ";append_json_string(out,e.what());out<<"\"}";return copy_result("{\"error\":\"OCCT-Fehler bei nativer Z-Level-Region\"}");}catch(...){return copy_result("{\"error\":\"OCCT-Fehler bei nativer Z-Level-Region\"}");}}

extern "C" void beblog_occt_free_string(char* value){std::free(value);}
