import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A2b1 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A2b1 contract failed: ${l}`);};
const native=read('src-tauri/native/occt_bridge.cpp');
const features=read('src/lib/stepManufacturingFeatures.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');

need(native,'const bool degenerated=BRep_Tool::Degenerated(edge)','native OCCT degeneracy remains authoritative');
need(native,'BRep_Tool::Pnt(TopoDS::Vertex(vit.Current()))','degenerated-edge location must come from native BRep vertex truth');
need(native,'\\\"degeneratedPoint\\\":','native bridge must export the collapsed topology location explicitly');
need(native,'if(BRep_Tool::Degenerated(edge))return;BRepAdaptor_Curve c(edge);','display edge sampling must not reinterpret a degenerated edge as a regular 3D curve');
need(features,'degeneratedPoint?:Point3Tuple','typed manufacturing edge must carry native degeneracy location');
need(features,'native Lage der degenerierten Kante fehlt oder ist ungültig.','degenerated edge without native location must fail closed');
need(features,'nicht degenerierte Kante darf keine Degenerated-Location tragen.','location truth must not appear on regular edges');
need(features,'degeneratedPoint:orientTuple3(edge.degeneratedPoint,orientation)','native degeneracy location must follow part orientation');

need(state,'selectedCurvedFaceTargetNeedsBoundaryProof','A23 boundary authority remains unchanged');
need(target,'verticalBoundaryCandidates','A19 candidates remain pending classification');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z ambiguity remains fail closed');

for(const bad of [
  "SURFACE_SINGULARITY",
  "INVALID_FOR_HEIGHTFIELD",
  "kind==='sphere'&&edge.degenerated",
  "face.kind==='sphere'&&edge.degenerated",
])forbid(state+target+features,bad,`A2b1 exports location truth only; classification is forbidden: ${bad}`);

console.log('008H-A24-A2b1 native degenerated-edge location truth contract PASS');
