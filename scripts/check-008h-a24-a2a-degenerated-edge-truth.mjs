import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A2a contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A2a contract failed: ${l}`);};

const native=read('src-tauri/native/occt_bridge.cpp');
const features=read('src/lib/stepManufacturingFeatures.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');

need(native,'BRep_Tool::Degenerated(edge)','native OCCT edge degeneracy must be the only source of degenerated-edge truth');
need(native,'\\\"degenerated\\\":','native bridge must export explicit degenerated state');
need(features,'degenerated:boolean','manufacturing edge source must carry explicit native degeneracy');
need(features,'native Degenerated-Semantik fehlt.','missing native degeneracy must fail validation');

need(state,'selectedCurvedFaceTargetNeedsBoundaryProof','A23 boundary authority must remain active');
need(target,'verticalBoundaryCandidates','A19 candidates must remain pending proof');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z ambiguity must remain fail closed');

for(const bad of [
  "degenerated?'SURFACE_SINGULARITY'",
  "degenerated?\"SURFACE_SINGULARITY\"",
  "kind==='sphere'&&edge.degenerated",
  "face.kind==='sphere'&&edge.degenerated",
])forbid(state+target+features,bad,`A2a must export truth, not classify candidates: ${bad}`);

console.log('008H-A24-A2a native degenerated-edge truth contract PASS');
