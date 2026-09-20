import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){if(!source.includes(text))throw new Error(`008H-A7 contract failed: ${label}`);}

const canonical=read('src/lib/canonicalToolpath.ts');
const a7=read('src/lib/threeDRoughingCanonicalSafeEdges.ts');

requireText(canonical,"'3d-roughing'","CanonicalToolpath must admit 3d-roughing");
requireText(canonical,"'3d-roughing-safe-edges'","dedicated A7 strategy missing");
requireText(a7,'chain.samples.length!==2','A7 must consume only minimal A6 two-point edges');
requireText(a7,"from.state!=='removable'||to.state!=='removable'","A7 must preserve A6 removable endpoints");
requireText(a7,'points:[{x:from.x,y:from.y},{x:to.x,y:to.y}]','A7 runs must preserve A6 endpoints exactly');
requireText(a7,"operationKind:'3d-roughing'","A7 canonical operation kind missing");
requireText(a7,"strategy:'3d-roughing-safe-edges'","A7 canonical strategy missing");
requireText(a7,'004T remains the','004T authority boundary missing');

for(const forbidden of ['endMillRoughingSafetyAt','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','rapid3','line3','arc3','retractAfter:false']){
  if(a7.includes(forbidden))throw new Error(`008H-A7 contract failed: forbidden shortcut ${forbidden}`);
}


console.log('008H-A7 canonical safe-edge materialization contract PASS');
