import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){if(!source.includes(text))throw new Error(`008H-A9 contract failed: ${label}`);}

const a9=read('src/lib/threeDRoughingMultiLevelCanonical.ts');

requireText(a9,"toolpath.operationKind!=='3d-roughing'","A9 must accept only A7 3D roughing toolpaths");
requireText(a9,"toolpath.strategy!=='3d-roughing-safe-edges'","A9 must accept only the approved A7 strategy");
requireText(a9,'toolpath.sourceOperationId!==operation.id','A9 must preserve operation ownership');
requireText(a9,'toolpath.runs.some(run=>Math.abs(run.z-levelZ)>EPS)','each A7 input must remain one constant Z level');
requireText(a9,'levelZ>=previousZ-EPS','A9 must require strictly descending level order');
requireText(a9,'runs.push(...toolpath.runs)','A9 must concatenate approved A7 runs without geometry invention');
requireText(a9,'004T remains the sole authority','004T authority boundary missing');

for(const forbidden of ['buildThreeDRoughingLevelEligibility','buildThreeDRoughingMaterialConnectivity','buildThreeDRoughingSafeChains','endMillRoughingSafetyAt','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','rapid3','line3','arc3','retractAfter:false']){
  if(a9.includes(forbidden))throw new Error(`008H-A9 contract failed: forbidden shortcut ${forbidden}`);
}


console.log('008H-A9 multi-level canonical assembly contract PASS');
