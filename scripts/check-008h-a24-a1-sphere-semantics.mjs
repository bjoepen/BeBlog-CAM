import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A1 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A1 contract failed: ${l}`);};

const native=read('src-tauri/native/occt_bridge.cpp');
const features=read('src/lib/stepManufacturingFeatures.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');

need(native,'s.GetType()==GeomAbs_Sphere','native bridge must identify analytic spheres');
need(native,'sphere.Location()','native sphere center must be exported');
need(native,'sphere.Axis().Direction()','native sphere axis must be exported');
need(native,'sphere.XAxis().Direction()','native sphere X direction must be exported');
need(native,'sphere.YAxis().Direction()','native sphere Y direction must be exported');
need(native,'sphere.Radius()','native sphere radius must be exported');
need(features,'interface StepSphericalFaceSource','typed sphere manufacturing source missing');
need(features,"kind:'sphere';center:Point3Tuple;axisDirection:Point3Tuple;xDirection:Point3Tuple;yDirection:Point3Tuple;radiusMm:number",'sphere source must carry complete A24-A1 analytic semantics');
need(features,"face.kind==='sphere'",'sphere semantics must be validated and orientation-aware');
need(features,'Kugelmittelpunkt fehlt oder ist ungültig.','sphere center validation missing');
need(features,'Kugelradius muss größer als 0 sein.','sphere radius validation missing');
need(features,'center:orientTuple3(face.center,orientation)','sphere center must follow part orientation');
need(features,'axisDirection:orientDirection3(face.axisDirection,orientation)','sphere axis must follow part orientation');

for(const bad of [
  "face.kind==='sphere')return true",
  "face.kind==='sphere')return false",
  "kind==='sphere'?true",
  "kind==='sphere'?false",
])forbid(state+target,bad,`A24-A1 must not classify or authorize degeneracy: ${bad}`);

need(state,'selectedCurvedFaceTargetNeedsBoundaryProof','A23 boundary authority must remain unchanged');
need(target,'verticalBoundaryCandidates','A19 degenerate candidates must remain fail-closed pending classification');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z ambiguity must remain fail closed');

console.log('008H-A24-A1 sphere semantics contract PASS');
