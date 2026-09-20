import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A11 contract failed: ${l}`);};

const op=read('src/lib/threeDRoughingOperation.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const safe=read('src/lib/safeMotionChain.ts');

need(op,"buildThreeDRoughingPipeline","operation state must delegate manufacturing truth to A10");
need(op,"toolpath:CanonicalToolpath|null","operation state must expose canonical output");
need(op,"if(pipeline.ok&&pipeline.toolpath)toolpath=pipeline.toolpath","only successful non-empty A10 output may be released");
need(op,"pipeline.ok&&!pipeline.toolpath","valid all-empty A10 output must remain non-manufacturing");
need(active,"const state=buildThreeDRoughingOperationState","active dispatch must use the released operation state");
need(active,"return state.ok?state.toolpath:null","active dispatch must fail closed");
need(preflight,"buildThreeDRoughingOperationState","preflight must reconstruct the same operation truth");
need(preflight,"materializeSafeMotionChain({toolpath:canonicalToolpath,safeZMm:operation.safeZMm})","004T must remain the motion materializer");
need(preflight,"validateCanonicalToolpath(canonicalToolpath)","canonical validation must remain in preflight");
if(preflight.includes('Der 3D-Schrupp-Kernel ist noch nicht freigegeben'))throw new Error('008H-A11 contract failed: obsolete preflight lock remains');
if(gcode.includes('3D Schruppen besitzt noch keinen freigegebenen Manufacturing-Toolpath'))throw new Error('008H-A11 contract failed: obsolete G-code lock remains');
need(gcode,"postCanonicalMachineMotions({motions:toolpath.motions??[],operation})","job NC must consume preflight/004T motions");
need(safe,"retractAfter !== false keeps the historic fail-closed behaviour","004T conservative retract authority missing");

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','retractAfter:false']){
  if(op.includes(forbidden))throw new Error(`008H-A11 contract failed: operation release invents forbidden manufacturing semantics via ${forbidden}`);
}
for(const forbidden of ['buildThreeDRoughingLevelEligibility','buildThreeDRoughingMaterialConnectivity','buildThreeDRoughingSafeChains','buildThreeDRoughingCanonicalSafeEdges']){
  if(preflight.includes(forbidden)||active.includes(forbidden)||gcode.includes(forbidden))throw new Error(`008H-A11 contract failed: production layer bypasses A10 via ${forbidden}`);
}
console.log('008H-A11 3D roughing manufacturing release contract PASS');
