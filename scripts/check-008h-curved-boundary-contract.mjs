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
const toolpath=fs.readFileSync('src/lib/modelRoughingToolpath.ts','utf8');
const raster=fs.readFileSync('src/lib/planarRasterKernel.ts','utf8');
const types=fs.readFileSync('src/lib/types.ts','utf8');
const zSlice=fs.readFileSync('src/lib/zLevelSlice.ts','utf8');

// 008H-M: selected Faces own bounded Stock−Model material before raster creation.
// Ownership follows the native OCCT outward side and stops at Face section endpoints.
for(const token of [
  'faceOwnedMaterialPoint',
  'faceExtrudesToMaterial',
  'faceOrientations',
  'sliceFaceSegmentsAtZ(part,faceIds,operation.faceIds,sliceZ,profile,faceOrientations)',
  'if(t<-1e-5||t>1+1e-5)return false',
  'ox*outward.x+oy*outward.y>=-1e-5',
  'ownershipFilter(targetFaceIds)',
  "buildDirection('x',[group.faceId])",
  "buildDirection('y',[group.faceId])",
]){
  if(!model.includes(token))throw new Error(`008H-M bounded owned-region contract missing: ${token}`);
}
for(const token of ['regionPointFilter?', 'regionPointFilter?.(region)']){
  if(!toolpath.includes(token))throw new Error(`008H-L toolpath-region contract missing: ${token}`);
}
for(const token of ['PlanarRasterPointFilter','pointFilter?:PlanarRasterPointFilter','safeAt(loops,point(primary,rowValue),radius,profile,pointFilter)','buildPlanarRasterStayDownConnector(loops,from,to,toolDiameterMm,sampleStep,profile,pointFilter)']){
  if(!raster.includes(token))throw new Error(`008H-L raster-region contract missing: ${token}`);
}
for(const token of ['ZLevelFaceSegment','sliceFaceSegmentsAtZ','faceId=faceIds[triangleIndex]','triangleNormal','outward:xyLength>EPS']){
  if(!zSlice.includes(token))throw new Error(`008H-L native Face/Z ownership missing: ${token}`);
}
for(const forbidden of [
  'clipToolpathToSelectedFaceSlices',
  'clipSegmentToFaceSlice',
  'faceContactRadius',
  'clipToolpathToFaceContactScope',
  'clipToolpathToZLocalFaceContactScope',
  'faceScopeContainsToolCenter',
  'pointSegmentDistanceXY',
]){
  if(model.includes(forbidden))throw new Error(`008H-L forbids post-toolpath Face clipping: ${forbidden}`);
}
if(!model.includes('operation.tool.diameterMm+2*allowance'))throw new Error('008H-L complete-solid accessibility clearance missing');
if(!model.includes('minX:-2*clearanceRadius')||!model.includes('maxX:stock.width+2*clearanceRadius'))throw new Error('008H-L stock-edge overhang contract missing');
const state=fs.readFileSync('src/lib/zLevelOperationState.ts','utf8');
if(!state.includes('buildModelRoughingOperationState({...args,scopeToSelectedFaces:true})')){
  throw new Error('008H curved targets must consume complete-solid Z-level truth');
}
const app=fs.readFileSync('src/App.svelte','utf8');
for(const token of ['updateZLevelFinishAllowance','Schlichtaufmaß','True Z-Level schneidet den vollständigen STEP-Solid']){
  if(!app.includes(token))throw new Error(`008H allowance UI contract missing: ${token}`);
}

for(const token of ["direction:'x'|'y'='x'","direction==='x'?b.minX:b.minY"]){
  if(!raster.includes(token))throw new Error(`008H-G raster direction kernel missing: ${token}`);
}
for(const token of ["ZLevelRasterDirection='auto'|'x'|'y'","rasterDirection?:ZLevelRasterDirection","rasterDirection:'auto'"]){
  if(!types.includes(token))throw new Error(`008H-G persisted raster direction missing: ${token}`);
}
for(const token of ["Rasterrichtung","Automatisch","Parallel X","Parallel Y","rasterDirection:'auto'","rasterDirection:'x'","rasterDirection:'y'"]){
  if(!app.includes(token))throw new Error(`008H-G UI contract missing: ${token}`);
}
console.log('PASS 008H-M: selected Faces own bounded outward Stock−Model material before raster generation; Face endpoints prevent adjacent-surface leakage; no post-toolpath clipping remains and downstream safety stays fail-closed.');
