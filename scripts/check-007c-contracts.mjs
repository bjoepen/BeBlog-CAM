import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const types=read('src/lib/types.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const canonicalPreflight=read('src/lib/canonicalPreflight.ts');
const surface=read('src/lib/surfaceCarveCanonicalToolpath.ts');
const planarCarve=read('src/lib/carveCanonicalToolpath.ts');
const contract=read('src/lib/surfaceCarveOperationContract.ts');
const safe=read('src/lib/safeMotionChain.ts');
const jobPreflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const post=read('src/lib/postprocessors.ts');
const rustImport=read('src-tauri/src/import.rs');
const fail=message=>{console.error(`007C contract FAIL: ${message}`);process.exit(1)};

if(!types.includes("kind:'surface-carve'"))fail('SurfaceCarveOperation is not defined as its own operation contract.');
if(!types.includes('export interface SurfaceCarveOperation'))fail('Standalone SurfaceCarveOperation type is missing.');
if(!types.includes('roughingOperationId:string|null'))fail('Surface Carve does not retain an explicit Z-Level predecessor reference.');
if(!types.includes('geometrySourceId:string|null'))fail('Surface Carve does not reserve an operation-owned secondary 2D geometry source.');
if(types.includes("OperationKind='facing'|'contour'|'pocket'|'carve'|'surface-carve'"))fail('007C must not expose unfinished Surface Carve in the existing operation UI before secondary geometry wiring.');

if(!canonical.includes("|'surface-carve'|'drill'"))fail('Canonical operation vocabulary does not distinguish Surface Carve from Carve.');
if(!canonical.includes("|'surface-carve'|'drill'|'helical-bore'"))fail('Canonical strategy vocabulary does not distinguish Surface Carve from Carve.');
if(!surface.includes("operationKind:'surface-carve'"))fail('Projected machining result is still mislabeled as normal Carve.');
if(!surface.includes("strategy:'surface-carve'"))fail('Projected machining strategy is still mislabeled as normal Carve.');
if(!surface.includes("planarCarveToolpath.operationKind!=='carve'"))fail('Surface Carve no longer accepts normalized planar Carve geometry as its source adapter.');
if(!planarCarve.includes("operationKind:'carve'"))fail('Normal planar Carve no longer remains normal Carve.');
if(planarCarve.includes('surface-carve'))fail('Normal planar Carve was contaminated with Surface Carve semantics.');
if(!canonicalPreflight.includes("toolpath.operationKind==='surface-carve'"))fail('Canonical preflight does not recognize Surface Carve explicit XYZ motion.');

if(!contract.includes("args.summary.kind!=='step'"))fail('Surface Carve is not restricted to STEP/BRep primary models.');
if(!contract.includes("operation.kind==='z-level-roughing'"))fail('Surface Carve contract does not require a Z-Level roughing predecessor.');
if(!contract.includes("(operation.roughingMode??'face-target')==='face-target'"))fail('Surface Carve predecessor is not restricted to face-target Z-Level roughing.');
if(!contract.includes('earlierOperations'))fail('Surface Carve does not enforce operation ordering.');
if(!contract.includes('successfulOperationIds.has(operation.id)'))fail('Surface Carve does not require the preceding Z-Level operation to be successful.');
if(!contract.includes('operation.faceIds.includes'))fail('Surface Carve does not require the predecessor to cover the same STEP face.');
if(!contract.includes('unter Bearbeiten geladene sekundäre 2D-Geometrie'))fail('Secondary geometry ownership under Bearbeiten is not encoded in validation.');

if(safe.includes("operationKind==='surface-carve'"))fail('004T was specialized for Surface Carve instead of staying generic.');
if(jobPreflight.includes('surfaceCarveOperationContract')||gcode.includes('surfaceCarveOperationContract')||post.includes('surfaceCarveOperationContract'))fail('Surface Carve operation contract was prematurely coupled into protected production paths.');
if(!rustImport.includes('"step"|"stp"')||!rustImport.includes('"dxf"'))fail('Primary importer no longer preserves STEP/STP and DXF support.');
if(!rustImport.includes('BeBlog CAM unterstützt STEP/STP und DXF.'))fail('Primary Bauteil import boundary is no longer explicit.');

console.log('007C contract PASS: Surface Carve is a distinct STEP-only operation contract with its own canonical identity, requires an earlier successful face-target Z-Level operation on the same face, reserves Bearbeiten-owned 2D geometry, and leaves normal Carve plus protected CAM paths separate.');
