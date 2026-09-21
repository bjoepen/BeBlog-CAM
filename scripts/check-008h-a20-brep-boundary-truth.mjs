import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A20 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A20 contract failed: ${l}`);};

const native=read('src-tauri/native/occt_bridge.cpp');
const features=read('src/lib/stepManufacturingFeatures.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');

need(native,'BRepTools::OuterWire(face)','OCCT outer-wire identity must be source truth');
need(native,'outer\\\":','native bridge must export outer-wire identity');
need(features,'outer?:boolean','wire model must carry native outer identity');
need(state,'buildOrientedStepManufacturingFeatureSource','shared 3D target state must consume BRep manufacturing topology');
need(state,'wire.outer===true','only native outer wires may prove selected-face outer boundary');
need(state,'outerBoundaryPolylines','placed outer boundary proof missing');
need(target,'brepOuterBoundaryPolylines','CurvedFaceTarget must accept BRep boundary truth');
need(target,'polylineBoundaryEdges(brepOuterBoundaryPolylines)','BRep boundary must drive degenerate-candidate proof when available');
need(target,'segmentCoveredByProjectedBoundary','A19 full-segment proof must remain');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z ambiguity must remain fail closed');

for(const bad of ['wire.outer!==false','Math.max(hit,z)','Math.min(hit,z)'])forbid(state+target,bad,`forbidden shortcut ${bad}`);
console.log('008H-A20 BRep boundary truth contract PASS');
