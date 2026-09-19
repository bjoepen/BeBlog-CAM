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
const nativeHeader=fs.readFileSync('src-tauri/native/occt_bridge.h','utf8');
const rustOcct=fs.readFileSync('src-tauri/src/occt.rs','utf8');
const tauriLib=fs.readFileSync('src-tauri/src/lib.rs','utf8');
const nativeCpp=fs.readFileSync('src-tauri/native/occt_bridge.cpp','utf8');
for(const token of [
  'beblog_occt_build_zlevel_regions(const char* request_json)',
]){
  if(!nativeHeader.includes(token))throw new Error(`008H-N1 native ABI contract missing: ${token}`);
}
for(const token of [
  'NativeZLevelRegionRequest',
  'NativeZLevelRegionSet',
  'NativeZLevelRegionIsland',
  'NATIVE_ZLEVEL_REGION_CONTRACT_VERSION',
  '008H-N1-v1',
  'NATIVE_FACE_ID_CONTRACT',
  'zero-based TopExp_Explorer(shape, TopAbs_FACE) order',
]){
  if(!rustOcct.includes(token))throw new Error(`008H-N1 Rust contract missing: ${token}`);
}
for(const token of [
  'NativeZLevelRegionRequest',
  'NativeZLevelRegionSet',
  'NativeZLevelRegionIsland',
  "NATIVE_ZLEVEL_REGION_CONTRACT_VERSION='008H-N1-v1'",
  'NATIVE_FACE_ID_CONTRACT',
]){
  if(!types.includes(token))throw new Error(`008H-N1 TypeScript contract missing: ${token}`);
}
for(const token of [
  'BRepAlgoAPI_Section',
  'BRepAlgoAPI_Common',
  'BRepAlgoAPI_Cut',
  'project_face_wires_to_plane',
  'project_face_outline_to_plane',
  'project_face_to_plane',
  'selected_face_projection',
  'solid_above_projection',
  'BRepProj_Projection',
  'HLRBRep_Algo',
  'HLRBRep_HLRToShape',
  'OutLineVCompound',
  'BOPAlgo_Tools::EdgesToWires',
  'BOPAlgo_Tools::WiresToFaces',
  'BRepPrimAPI_MakeBox',
  'face_target_material_region',
  'transform_shape(source,request)',
  'transform_shape(faces[id],request)',
  'total.PreMultiply(r)',
  'total.PreMultiply(tr)',
  'OCCT could not prove a Face-target Stock-model material region; fail-closed',
  'no mixed-dimensional solid subtraction or display triangulation used',
]){
  if(!nativeCpp.includes(token))throw new Error(`008H-N2 native geometry kernel missing: ${token}`);
}
for(const token of [
  'fn build_zlevel_regions(&self, request: &NativeZLevelRegionRequest)',
  'fn beblog_occt_build_zlevel_regions(request_json: *const c_char)',
  'native::build_zlevel_regions(request)',
]){
  if(!rustOcct.includes(token))throw new Error(`008H-N2 Rust backend missing: ${token}`);
}
for(const token of [
  'fn build_native_zlevel_regions(request: NativeZLevelRegionRequest)',
  'Occt8Backend.build_zlevel_regions(&request)',
  'build_native_zlevel_regions, new_project',
]){
  if(!tauriLib.includes(token))throw new Error(`008H-N2 Tauri boundary missing: ${token}`);
}
const diagnosticApp=fs.readFileSync('src/App.svelte','utf8');
for(const token of [
  'runNativeRegionDiagnostic',
  "invoke<NativeZLevelRegionSet>('build_native_zlevel_regions'",
  '008H-N2 · Native Region Diagnose',
  'Diagnose aktiv:',
  "canonicalToolpath={activeStep==='Bearbeiten'&&!nativeRegionDiagnostic?activeCanonicalToolpath:null}",
  'nativeRegionDiagnostic={activeStep',
]){
  if(!diagnosticApp.includes(token))throw new Error(`008H-N2 diagnostic view missing: ${token}`);
}
const diagnosticView=fs.readFileSync('src/lib/GeometryView.svelte','utf8');
for(const token of ['nativeRegionDiagnostic','nativeRegionWorld','native-region-proof','diagnosticActive?[]'])if(!diagnosticView.includes(token))throw new Error(`008H-N2 viewport isolation missing: ${token}`);
if(nativeCpp.includes('TopoDS_Shape project_wires_to_plane('))throw new Error('008H-N2c forbids generic all-wire projection for curved Face ownership');
if(!nativeCpp.includes('if(surface.GetType()==GeomAbs_Plane)return project_face_wires_to_plane(face,target);'))throw new Error('008H-N2c must route curved Faces through exact silhouette projection');
if(nativeCpp.includes('projected_face_footprint'))throw new Error('008H-N2b forbids rejected sampled Face-footprint projection');
if(nativeCpp.includes('BRepAlgoAPI_Cut material(inStock.Shape(),fullModel)'))throw new Error('008H-N2b forbids rejected 2D-minus-3D mixed-dimensional Boolean');
if(!nativeCpp.includes('BRepAlgoAPI_Cut material(selectedInStock.Shape(),aboveProjection)'))throw new Error('008H-N2b must subtract solid-above planar projection from selected planar projection');
const nativeRegionStart=nativeCpp.indexOf('extern "C" char* beblog_occt_build_zlevel_regions');
const nativeRegionEnd=nativeCpp.indexOf('extern "C" void beblog_occt_free_string',nativeRegionStart);
if(nativeRegionStart<0||nativeRegionEnd<=nativeRegionStart){
  throw new Error('008H-N2 native region builder source boundary missing');
}
const nativeRegionBuilder=nativeCpp.slice(nativeRegionStart,nativeRegionEnd);
if(nativeRegionBuilder.includes('displayVertices')||nativeRegionBuilder.includes('BRepMesh_IncrementalMesh')||nativeRegionBuilder.includes('sliceTrianglesAtZ')){
  throw new Error('008H-N2 native region builder must not consume display triangulation geometry');
}
// displayFaceIds is permitted only as literal documentation of the stable Face-ID
// contract in the JSON response. Geometry consumption is guarded by the absence
// of BRepMesh_IncrementalMesh/displayVertices and by native BRepAlgoAPI_Section.
const faceIdMentions=[...nativeRegionBuilder.matchAll(/displayFaceIds/g)].length;
if(faceIdMentions>1){
  throw new Error('008H-N2 native region builder contains unexpected displayFaceIds usage beyond Face-ID contract metadata');
}

console.log('PASS 008H-N2b contract: FreeCAD-style selected planar projection minus solid-above planar projection is enforced. Rejected sampled footprint and mixed-dimensional 2D-minus-3D Boolean are forbidden; display triangulation remains excluded. Production CAM has not switched consumers.');
