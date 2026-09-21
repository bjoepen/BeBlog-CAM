import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A23 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A23 contract failed: ${l}`);};

const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const roughing=read('src/lib/threeDRoughingOperation.ts');
const finishing=read('src/lib/surfaceFinishingOperation.ts');

need(state,'type PlacedOuterBoundaryResult=','BRep boundary construction needs an explicit result state');
need(state,'selectedCurvedFaceTargetNeedsBoundaryProof','shared Surface Truth must ask whether a degenerate candidate needs boundary proof');
need(target,'export function selectedCurvedFaceTargetNeedsBoundaryProof','boundary-proof demand must be derived from selected target triangles');
need(target,'Math.abs(area2(partTriangles[i],partTriangles[i+1],partTriangles[i+2]))<=EPS','boundary-proof demand must use the same XY-degeneracy predicate as CurvedFaceTarget');
need(state,'if(needsBoundaryProof){','BRep authority must be required only when a selected degenerate candidate needs proof');
need(state,'placedOuterBoundaryGeometry(summary,orientation,faceIds,part)','required boundary proof must use placed BRep manufacturing topology');
need(state,'if(outerBoundary.ok===false){','unavailable required BRep boundary truth must stop shared 3D target construction');
need(state,'errors:[outerBoundary.error]','boundary failure reason must reach the shared 3D surface state');
need(state,'boundaryGeometry=outerBoundary.geometry','only proven BRep boundary geometry may authorize degenerate candidates');
need(state,'buildCurvedFaceTarget(part,displayFaceIds,faceIds,undefined,boundaryGeometry)','shared target must receive the conditional authority result');
need(state,'wire.outer===true','native outer-wire identity must remain authoritative');
need(state,'noch nicht analytisch','unsupported required outer-edge kinds must fail closed');
need(target,'brepOuterBoundaryGeometry','CurvedFaceTarget must retain BRep boundary authority');
need(roughing,'buildThreeDSurfaceTargetState','3D roughing must stay linked to shared Surface Truth');
need(finishing,'buildThreeDSurfaceTargetState','3D finishing must stay linked to shared Surface Truth');

for(const bad of [
  'outerBoundaryGeometry??undefined',
  'outerBoundary.geometry??undefined',
  'const outerBoundary=placedOuterBoundaryGeometry(summary,orientation,faceIds,part);\n  if(outerBoundary.ok===false)',
])forbid(state,bad,`unconditional or silent BRep authority path remains possible: ${bad}`);

console.log('008H-A23 BRep boundary authority contract PASS');
