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
for(const token of ['PlanarRasterPointFilter','pointFilter?:PlanarRasterPointFilter','safeAt(scopeLoops,safetyLoops,point(primary,rowValue),radius,profile,pointFilter)','buildPlanarRasterStayDownConnector(scopeLoops,from,to,toolDiameterMm,sampleStep,profile,pointFilter,safetyLoops,clearanceAlreadyApplied)']){
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
// 008H-N3 supersedes the historical L/M curved-target assertion above.
// Whole-model roughing still owns complete-solid Z-level truth; curved Face
// targets must now fail closed here and consume native OCCT regions through
// the asynchronous production adapter in App/preflight.
if(state.includes('buildModelRoughingOperationState({...args,scopeToSelectedFaces:true})')){
  throw new Error('008H-N3 forbids the rejected TypeScript curved Face ownership fallback');
}
if(!state.includes('Kein TypeScript-Ownership-Fallback zulässig')){
  throw new Error('008H-N3 curved Face targets must fail closed without native OCCT truth');
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
  '008H-N5-v3',
  'NATIVE_FACE_ID_CONTRACT',
  'zero-based TopExp_Explorer(shape, TopAbs_FACE) order',
]){
  if(!rustOcct.includes(token))throw new Error(`008H-N1 Rust contract missing: ${token}`);
}
for(const token of [
  'NativeZLevelRegionRequest',
  'NativeZLevelRegionSet',
  'NativeZLevelRegionIsland',
  "NATIVE_ZLEVEL_REGION_CONTRACT_VERSION='008H-N5-v3'",
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
  'face_sublevel_shadow',
  'transform_shape(source,request)',
  'transform_shape(faces[id],request)',
  'total.PreMultiply(r)',
  'total.PreMultiply(tr)',
  'OCCT N5 stage=Tz/',
  'selected-Face Tz, cutter-contact dilation, complete-solid Cz, Az intersection',
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
  '008H-N5 · Native Region Diagnose',
  'Diagnose aktiv:',
  "canonicalToolpath={activeStep==='Bearbeiten'&&!nativeRegionDiagnostic?activeCanonicalToolpath:null}",
  'nativeRegionDiagnostic={activeStep',
]){
  if(!diagnosticApp.includes(token))throw new Error(`008H-N2 diagnostic view missing: ${token}`);
}
const diagnosticView=fs.readFileSync('src/lib/GeometryView.svelte','utf8');
for(const token of ['nativeRegionDiagnostic','nativeRegionWorld','native-region-proof','diagnosticActive?[]'])if(!diagnosticView.includes(token))throw new Error(`008H-N2 viewport isolation missing: ${token}`);
if(nativeCpp.includes('TopoDS_Shape project_wires_to_plane('))throw new Error('008H-N2c forbids generic all-wire projection for curved Face ownership');
if(nativeCpp.includes('if(surface.GetType()==GeomAbs_Plane)return project_face_wires_to_plane(face,target);'))throw new Error('008H-N2c superseded blanket curved-Face HLR dispatch must not return');
if(nativeCpp.includes('projected_face_footprint'))throw new Error('008H-N2b forbids rejected sampled Face-footprint projection');
if(nativeCpp.includes('BRepAlgoAPI_Cut material(inStock.Shape(),fullModel)'))throw new Error('008H-N2b forbids rejected 2D-minus-3D mixed-dimensional Boolean');
if(nativeCpp.includes('BRepAlgoAPI_Cut material(selectedInStock.Shape(),above.shape)'))throw new Error('008H-N5 forbids solid-above subtraction from selected-Face Tz');
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

console.log('PASS 008H native projection contract: selected-Face sublevel shadow and independent complete-solid safety are enforced; display triangulation remains excluded.');

const nativeProduction=fs.readFileSync('src/lib/nativeFaceTargetToolpath.ts','utf8');
for(const token of ['buildNativeFaceTargetCanonicalToolpath','regionsFromNative','buildModelRoughingCanonicalToolpath','008H-N5 production boundary']){
  if(!nativeProduction.includes(token))throw new Error(`008H-N3 production adapter missing: ${token}`);
}
const zLevelState=fs.readFileSync('src/lib/zLevelOperationState.ts','utf8');
if(zLevelState.includes('buildModelRoughingOperationState({...args,scopeToSelectedFaces:true})'))throw new Error('008H-N3 forbids rejected 008H-M ownership fallback for curved Face targets');
if(!zLevelState.includes('Kein TypeScript-Ownership-Fallback zulässig'))throw new Error('008H-N3 synchronous curved Face path must fail closed without native truth');
for(const token of ['refreshNativeFaceTargetProduction','buildNativeFaceTargetCanonicalToolpath','nativeFaceTargetOverrides','canonicalOverrides:nativeFaceTargetOverrides']){
  if(!diagnosticApp.includes(token))throw new Error(`008H-N3 App production integration missing: ${token}`);
}
const preflight=fs.readFileSync('src/lib/jobPreflight.ts','utf8');
for(const token of ['canonicalOverrides?:Record<string,CanonicalToolpath|null>','hasOverride','autoritative native Face-Target-Werkzeugbahn']){
  if(!preflight.includes(token))throw new Error(`008H-N3 preflight/NC truth integration missing: ${token}`);
}

const nativeFaceTargetToolpath=fs.readFileSync('src/lib/nativeFaceTargetToolpath.ts','utf8');
for(const token of ['Z=${region.z.toFixed(3)} mm','region.errors.map']){
  if(!nativeFaceTargetToolpath.includes(token))throw new Error(`008H-N3 native root-cause propagation missing: ${token}`);
}
if(!preflight.includes('canonicalOverrideErrors?:Record<string,string[]>')||!preflight.includes('args.canonicalOverrideErrors?.[operation.id]'))throw new Error('008H-N3 preflight must expose concrete native Face-target errors');
if(!diagnosticApp.includes('canonicalOverrideErrors:nativeFaceTargetErrors'))throw new Error('008H-N3 App must pass concrete native Face-target errors into preflight');

for(const token of ['FaceTargetRegionProbe','failedStage','selectedProjectionFaces','selectedInStockFaces','materialFaces','OCCT N5 stage=Tz/']){
  if(!nativeCpp.includes(token))throw new Error(`008H-N3 native stage diagnostics missing: ${token}`);
}

for(const token of ['const TopoDS_Shape trimmedBoundary=project_face_wires_to_plane(face,target);','if(!trimmedBoundary.IsNull()&&count_subshapes(trimmedBoundary,TopAbs_FACE)>0)return trimmedBoundary;','case GeomAbs_Cylinder:','case GeomAbs_Cone:','case GeomAbs_Sphere:','return project_face_outline_to_plane(face,target);','projectionDispatch="selected-face-sublevel"']){
  if(!nativeCpp.includes(token))throw new Error(`008H-N2d trimmed Face boundary / HLR fallback contract missing: ${token}`);
}

for(const token of ['surfaceType','projectionDispatch','sourceWires','closedSourceWires','sourceEdges','projectedShapes','surface=','dispatch=']){
  if(!nativeCpp.includes(token))throw new Error(`008H-N2 selected Face projection probe missing: ${token}`);
}

// 008H-N5: Tz is selected-Face-only; native contact dilation and complete-solid
// Cz produce the final cutter-center Az region before rastering.
for(const token of ['tzIslands','contactIslands','czIslands','azIslands','toolDiameterMm','finishAllowanceMm'])if(!types.includes(token))throw new Error(`008H-N5 TypeScript wire contract missing: ${token}`);
for(const token of ['tz_islands','contact_islands','cz_islands','az_islands','tool_diameter_mm','finish_allowance_mm'])if(!rustOcct.includes(token))throw new Error(`008H-N5 Rust wire contract missing: ${token}`);
for(const token of ['face_sublevel_shadow','BRepAlgoAPI_Common common(selected,lowerBox)','IntCurvesFace_Intersector','ray.State(i)','selected_face_contact_tolerance','BRep_Tool::Tolerance(selected)','contact.point.Distance(point)<=tolerance','BoundaryBelow','BoundaryAbove','GenuineInteriorAmbiguous','tzKernelFailure','tzInteriorMultiZ','aboveOutsideTz=','noContactOutsideTz=','offset_planar_region(tzShape,toolDiameter/2)','cutter_safety_region','cutZ-finishAllowance','toolDiameter/2+finishAllowance','stockMargin=2*clearanceRadius','offset_planar_region(safety.material,-clearanceRadius)','BRepAlgoAPI_Common common(contactShape,czShape)']){
  if(!nativeCpp.includes(token))throw new Error(`008H-N5 native geometry stage missing: ${token}`);
}
if(nativeCpp.includes('tzVerticalRayAmbiguity'))throw new Error('008H-N5 ray proof must not collapse kernel, outside-sublevel and genuine interior multi-Z outcomes');
if(nativeCpp.includes('contact==VerticalContact::None||contact==VerticalContact::UniqueAbove'))throw new Error('008H-N5 expected outside-Tz ray samples must not fail the operation');
if(nativeCpp.includes('face_target_material_region('))throw new Error('008H-N5 forbids selectedProjection - solidAboveProjection as Tz');
for(const token of ['clearanceAlreadyApplied','const radius=clearanceAlreadyApplied?0:toolDiameterMm/2','const scopeInset=clearanceAlreadyApplied?0:','nativeCutterCenterRegion'])if(!(raster+toolpath).includes(token))throw new Error(`008H-N5 pre-clearanced raster contract missing: ${token}`);
for(const token of ['region.azIslands','cutterCenterLoopsByZ','region=>cutterCenterByZ.get(region.z.toFixed(6))','true,'])if(!nativeProduction.includes(token))throw new Error(`008H-N5 native Az production adapter missing: ${token}`);
for(const token of ['stage=Tz/','stage=contactDilation','stage=Cz/','stage=Az/intersection'])if(!nativeCpp.includes(token))throw new Error(`008H-N5 stage diagnostic missing: ${token}`);
if(!diagnosticApp.includes('finishAllowanceMm:Math.max(0,op.finishAllowanceMm),toolDiameterMm:op.tool.diameterMm'))throw new Error('008H-N5 production request must carry physical tool and real finish allowance');
