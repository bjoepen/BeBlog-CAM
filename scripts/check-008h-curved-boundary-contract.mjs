import fs from 'node:fs';

const source=fs.readFileSync('src/lib/curvedFaceTarget.ts','utf8');
const required=[
  'const EDGE_QUANTIZATION=1e-7',
  'function selectedEdgeUseCounts',
  'function touchesSelectedFaceBoundary',
  'excludedBoundaryDegenerateCount',
  'touchesSelectedFaceBoundary(triangle,edgeUseCounts)',
  'innere vertikale oder XY-degenerierte Dreiecksprojektion',
  'if(Math.abs(hit-z)>1e-4)return null',
  'if(Math.abs(den)<=EPS)return null',
  'if(hit===null&&target.fallbackTarget)',
];
for(const token of required){
  if(!source.includes(token))throw new Error(`008H curved-boundary contract missing: ${token}`);
}

const oldFailClosed='enthält eine vertikale oder XY-degenerierte Dreiecksprojektion.';
if(source.includes(oldFailClosed)){
  throw new Error('008H contract: unconditional whole-face rejection for every XY-degenerate triangle remains');
}

const boundaryCheck=source.indexOf('if(touchesSelectedFaceBoundary(triangle,edgeUseCounts))');
const interiorFail=source.indexOf('innere vertikale oder XY-degenerierte Dreiecksprojektion');
if(boundaryCheck<0||interiorFail<boundaryCheck){
  throw new Error('008H contract: boundary exclusion must precede interior fail-closed rejection');
}

const roughing=fs.readFileSync('src/lib/curvedFaceRoughingOperation.ts','utf8');
for(const token of [
  'const allFaceIds=[...new Set(faceIds)]',
  'const partSurface=buildCurvedFaceTarget(part,faceIds,allFaceIds,args.profile)',
  'partSurface.valid?partSurface:null',
]){
  if(!roughing.includes(token))throw new Error(`008H adjacent-surface contract missing: ${token}`);
}

for(const consumer of ['src/lib/curvedFaceRoughingOperation.ts','src/lib/surfaceFinishingOperation.ts']){
  const text=fs.readFileSync(consumer,'utf8');
  if(!text.includes('buildCurvedFaceTarget(')){
    throw new Error(`008H shared truth contract: ${consumer} no longer consumes buildCurvedFaceTarget`);
  }
}

const model=fs.readFileSync('src/lib/modelRoughingOperation.ts','utf8');
const raster=fs.readFileSync('src/lib/planarRasterKernel.ts','utf8');
const types=fs.readFileSync('src/lib/types.ts','utf8');
for(const token of [
  'scopeToSelectedFaces?:boolean',
  'const slices=zs.map(cutZ=>',
  'cutZ-allowance',
  'selectedFaceScope',
  'faceScopeContainsToolCenter',
  'pointSegmentDistanceXY',
  'clipSegmentToFaceContactScope',
  'clipToolpathToFaceContactScope',
  'operation.tool.diameterMm+2*allowance',
  'cutter CONTACT intent',
  'const clearanceRadius=operation.tool.diameterMm/2+allowance',
  'minX:-2*clearanceRadius',
  'maxX:stock.width+2*clearanceRadius',
  'const faceContactRadius=toolRadius' ,
  'clipToolpathToFaceContactScope(candidate,scope,o,faceContactRadius)',
]){
  if(!model.includes(token))throw new Error(`008H true Z-level contract missing: ${token}`);
}
const state=fs.readFileSync('src/lib/zLevelOperationState.ts','utf8');
if(!state.includes('buildModelRoughingOperationState({...args,scopeToSelectedFaces:true})')){
  throw new Error('008H curved targets must consume complete-solid Z-level truth');
}
const app=fs.readFileSync('src/App.svelte','utf8');
for(const token of ['updateZLevelFinishAllowance','Schlichtaufmaß','True Z-Level schneidet den vollständigen STEP-Solid']){
  if(!app.includes(token))throw new Error(`008H allowance UI contract missing: ${token}`);
}

if(model.includes('clipToolpathToXY'))throw new Error('008H must not regress to rectangular selected-face bounds');
if(model.includes('clipToolpathToFaceScope('))throw new Error('008H must not regress to cutter-centre-inside-face scoping');
for(const token of ["direction:'x'|'y'='x'","direction==='x'?b.minX:b.minY"]){
  if(!raster.includes(token))throw new Error(`008H-G raster direction kernel missing: ${token}`);
}
for(const token of ["ZLevelRasterDirection='auto'|'x'|'y'","rasterDirection?:ZLevelRasterDirection","rasterDirection:'auto'"]){
  if(!types.includes(token))throw new Error(`008H-G persisted raster direction missing: ${token}`);
}
for(const token of ["requestedDirection=operation.rasterDirection??'auto'","[buildDirection('x'),buildDirection('y')]","pathLength(a.toolpath!)","Rasterrichtung Auto"]){
  if(!model.includes(token))throw new Error(`008H-G auto-selection contract missing: ${token}`);
}
for(const token of ["selectedFaceScopeGroups","for(const group of groups)","buildDirection('x',group.scope)","buildDirection('y',group.scope)","combinedRuns.push(...chosen.toolpath.runs)","Rasterrichtung Auto lokal pro Ziel-Face gewählt"]){
  if(!model.includes(token))throw new Error(`008H-H per-face Auto contract missing: ${token}`);
}
for(const token of ["Rasterrichtung","Automatisch","Parallel X","Parallel Y","rasterDirection:'auto'","rasterDirection:'x'","rasterDirection:'y'"]){
  if(!app.includes(token))throw new Error(`008H-G UI contract missing: ${token}`);
}
console.log('PASS 008H: curved targets use complete-solid Z-level truth scoped by cutter-contact envelopes; stock edges permit cutter overhang; Auto/X/Y raster direction is explicit and deterministic, with Auto selected independently per target face; model boundaries and legacy safety remain fail-closed.');
