import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){
  if(!source.includes(text))throw new Error(`008H-A6 contract failed: ${label}`);
}

const chains=read('src/lib/threeDRoughingSafeChains.ts');

requireText(chains,'endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm)',"every candidate edge must delegate cutter safety to A3");
requireText(chains,"from.cutZ+EPS<safety.safety.safeZ","intermediate segment samples must respect A3 safeZ");
requireText(chains,'immediate orthogonal',"A6 must be limited to immediate orthogonal A5 edges");
requireText(chains,"direction==='x'","A6 strategy must honor the selected X/Y roughing direction");
requireText(chains,'samples:[sample,next]',"A6 must expose minimal proven edges, not invent path ordering");
requireText(chains,'creates no CanonicalToolpath',"A6 non-manufacturing boundary comment missing");

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','rapid3','line3','arc3']){
  if(chains.includes(forbidden))throw new Error(`008H-A6 contract failed: forbidden dependency ${forbidden}`);
}

// A6 owns no canonical output itself. Later approved stages may extend the
// shared CanonicalToolpath union; this historical gate must not veto them.
// The A6 source intentionally contains the phrase "creates no CanonicalToolpath"
// in its boundary comment, so dependencies/constructors are the enforceable check.
for(const forbiddenCanonical of ["from './canonicalToolpath'","operationKind:'3d-roughing'","strategy:'3d-roughing-safe-edges'"]){
  if(chains.includes(forbiddenCanonical))throw new Error(`008H-A6 contract failed: A6 itself must not emit canonical output via ${forbiddenCanonical}`);
}

console.log('008H-A6 safe roughing chains contract PASS');
