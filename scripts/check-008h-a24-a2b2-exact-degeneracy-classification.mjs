import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A2b2 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A2b2 contract failed: ${l}`);};

const classifier=read('src/lib/threeDDegeneracyClassification.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const features=read('src/lib/stepManufacturingFeatures.ts');

for(const stateName of ['BOUNDARY','SURFACE_SINGULARITY','INVALID_FOR_HEIGHTFIELD','UNRESOLVED'])
  need(classifier,`'${stateName}'`,`four-state classifier must contain ${stateName}`);

need(classifier,"proofs.length!==1",'zero or competing proofs must remain unresolved');
need(classifier,"proof:null",'unresolved classification must not retain an arbitrary proof');
need(classifier,"proof.kind==='boundary'",'boundary classification consumes an explicit boundary proof');
need(classifier,"proof.kind==='surface-singularity'",'singularity classification consumes an explicit singularity proof');
need(classifier,"classification:'INVALID_FOR_HEIGHTFIELD'",'explicit heightfield-invalid proof has its own state');

for(const bad of [
  "face.kind==='sphere'",
  "kind==='sphere'&&",
  "degenerated===true",
  "degenerated?'SURFACE_SINGULARITY'",
  "no OuterWire",
])forbid(classifier,bad,`classifier must not discover geometric truth itself: ${bad}`);

need(state,'selectedCurvedFaceTargetNeedsBoundaryProof','A23 boundary authority remains unchanged in A2b2');
need(target,'verticalBoundaryCandidates','A19 candidate handling remains unchanged in A2b2');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z fail-closed remains unchanged');
need(features,'degeneratedPoint?:Point3Tuple','A2b1 native location truth remains available');

forbid(state,"classifyProvenDegeneracy",'A2b2 must not integrate classification into manufacturing state yet');
forbid(target,"classifyProvenDegeneracy",'A2b2 must not bypass A19/A20/A23 yet');

console.log('008H-A24-A2b2 proof-only four-state degeneracy classifier contract PASS');
