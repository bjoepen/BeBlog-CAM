import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){if(!source.includes(text))throw new Error(`008H-A13 contract failed: ${label}`);}
function forbidText(source,text,label){if(source.includes(text))throw new Error(`008H-A13 contract failed: ${label}`);}

const operation=read('src/lib/threeDRoughingOperation.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const schedule=read('src/lib/threeDRoughingZLevelSchedule.ts');
const safety=read('src/lib/endMillRoughingSafety.ts');
const reachability=read('src/lib/flatEndCutterReachability.ts');

requireText(operation,"z:wcs.z==='top'?stock.thickness:0",'3D roughing must resolve the same stock/WCS Z origin as 3D finishing');
requireText(operation,'translateCurvedFaceTarget(target,{x:-origin.x,y:-origin.y,z:-origin.z})','Surface Truth must be translated as a whole into WCS');
requireText(operation,'buildThreeDRoughingPipeline({target:wcsTarget,partSafety,stock,wcs,operation})','A10 must consume WCS-normalized Surface Truth');
requireText(target,'export function translateCurvedFaceTarget(','CurvedFaceTarget needs an explicit rigid translation helper');
requireText(target,'spatialIndex:buildSpatialIndex(triangles,bounds)','translated Surface Truth must rebuild its spatial index');
requireText(schedule,'const topZ=0','A8 must keep WCS stock top at Z=0');
requireText(safety,'safeZ:reachability.reachableFloorZ','A3 safety must consume A16 reachability without a coordinate conversion');
requireText(reachability,'const reachableFloorZ=protectedMaxZ+finishAllowanceMm','A16 reachable floor must remain in the coordinate space of its WCS-normalized inputs');

for(const source of [schedule,safety,reachability]){
  forbidText(source,'stock.thickness-','A13 must not introduce an ad-hoc local Z correction inside A8/A3');
}
for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt']){
  forbidText(operation,forbidden,`release integration must not import forbidden geometry path ${forbidden}`);
}

console.log('008H-A13 3D roughing coordinate-space integration contract PASS');
