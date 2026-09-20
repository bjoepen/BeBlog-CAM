import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){if(!source.includes(text))throw new Error(`008H-A8 contract failed: ${label}`);}

const a8=read('src/lib/threeDRoughingZLevelSchedule.ts');
const operation=read('src/lib/threeDRoughingOperation.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');

requireText(a8,"if(wcs.z!=='top')",'A8 must retain top-WCS contract');
requireText(a8,'const topZ=0','upper schedule boundary must come from stock-top datum');
requireText(a8,'target.bounds.minZ+operation.finishAllowanceMm','lower schedule boundary must derive from 3D target plus allowance');
requireText(a8,'Math.max(-stock.thickness','lower schedule boundary must remain inside stock truth');
requireText(a8,'operation.stepDownMm>0','stepDown must be validated');
requireText(a8,'z-=operation.stepDownMm','levels must descend deterministically by stepDown');
requireText(a8,'levels.push(bottomZ)','exact lower boundary must be represented');
if(a8.includes('totalDepthMm'))throw new Error('008H-A8 contract failed: totalDepthMm must not define 3D roughing depth');

for(const forbidden of ['buildThreeDRoughingLevelEligibility','buildThreeDRoughingMaterialConnectivity','buildThreeDRoughingSafeChains','buildThreeDRoughingCanonicalSafeEdges','CanonicalToolpath','CanonicalMachineMotion','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','rapid3','line3','arc3']){
  if(a8.includes(forbidden))throw new Error(`008H-A8 contract failed: forbidden cross-stage dependency ${forbidden}`);
}

requireText(operation,'toolpath:null;','A8 must not open production operation state');
requireText(active,"if(operation.kind==='3d-roughing')",'3D roughing active dispatch missing');
requireText(active,'return null;','A8 must not open active production dispatch');
requireText(preflight,'Der 3D-Schrupp-Kernel ist noch nicht freigegeben','A8 must retain preflight manufacturing gate');

console.log('008H-A8 deterministic Z-level schedule contract PASS');
