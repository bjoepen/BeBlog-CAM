import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){
  if(!source.includes(text))throw new Error(`008H-A4 contract failed: ${label}`);
}

const eligibility=read('src/lib/threeDRoughingLevelEligibility.ts');
const operation=read('src/lib/threeDRoughingOperation.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');

requireText(eligibility,"endMillRoughingSafetyAt(target,x,y,cutterRadiusMm,finishAllowanceMm)","A4 must delegate cutter safety to A3");
requireText(eligibility,"state:'unresolved'","unresolved samples must remain explicit and fail-closed");
requireText(eligibility,"cutZ+EPS>=safety.safety.safeZ","eligibility must compare query Z against A3 safeZ");
requireText(eligibility,"This function deliberately creates no regions, chains, toolpaths or motions.","A4 boundary comment missing");

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','CanonicalToolpath','CanonicalMachineMotion','ballnoseContactAt']){
  if(eligibility.includes(forbidden))throw new Error(`008H-A4 contract failed: forbidden dependency ${forbidden}`);
}

requireText(operation,'toolpath:null;','3D roughing operation must remain non-manufacturing in A4');
requireText(active,"if(operation.kind==='3d-roughing')","3D roughing dispatch missing");
requireText(active,'return null;','A4 must not emit active canonical toolpath');

console.log('008H-A4 level eligibility contract PASS');
