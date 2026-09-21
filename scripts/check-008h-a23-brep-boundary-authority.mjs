import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A23 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A23 contract failed: ${l}`);};

const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const roughing=read('src/lib/threeDRoughingOperation.ts');
const finishing=read('src/lib/surfaceFinishingOperation.ts');

need(state,'type PlacedOuterBoundaryResult=','BRep boundary construction needs an explicit result state');
need(state,"|{ok:false;error:string}","boundary failure must carry an explicit reason");
need(state,"if(outerBoundary.ok===false){","unavailable BRep boundary truth must stop shared 3D target construction");
need(state,"errors:[outerBoundary.error]","boundary failure reason must reach the shared 3D surface state");
need(state,"outerBoundary.geometry","only proven BRep boundary geometry may enter CurvedFaceTarget");
need(state,"wire.outer===true","native outer-wire identity must remain authoritative");
need(state,"noch nicht analytisch","unsupported outer-edge kinds must be explicit fail-closed states");
need(target,'brepOuterBoundaryGeometry','CurvedFaceTarget must retain BRep boundary authority');
need(roughing,'buildThreeDSurfaceTargetState','3D roughing must stay linked to shared Surface Truth');
need(finishing,'buildThreeDSurfaceTargetState','3D finishing must stay linked to shared Surface Truth');

for(const bad of [
  'outerBoundaryGeometry??undefined',
  'outerBoundary.geometry??undefined',
  'placedOuterBoundaryGeometry(summary,orientation,faceIds,part);\n  const target=buildCurvedFaceTarget',
])forbid(state,bad,`silent BRep-to-mesh fallback remains possible: ${bad}`);

console.log('008H-A23 BRep boundary authority contract PASS');
