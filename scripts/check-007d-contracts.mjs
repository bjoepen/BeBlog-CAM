import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const types=read('src/lib/types.ts');
const app=read('src/App.svelte');
const panel=read('src/lib/SurfaceCarvePanel.svelte');
const persistence=read('src/lib/projectPersistence.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const post=read('src/lib/postprocessors.ts');
const rustImport=read('src-tauri/src/import.rs');
const fail=message=>{console.error(`007D contract FAIL: ${message}`);process.exit(1)};

if(!types.includes("OperationKind='facing'|'contour'|'pocket'|'carve'|'surface-carve'"))fail('Surface Carve is not exposed as its own product operation kind.');
if(!types.includes('CarveOperation|SurfaceCarveOperation|DrillOperation'))fail('Surface Carve is not part of CamOperation as a distinct operation.');
if(!types.includes('geometrySource:SurfaceCarveGeometrySourceRef|null'))fail('Surface Carve does not own a persisted secondary 2D geometry reference.');
if(!types.includes('offsetX:number;offsetY:number;scale:number;rotationDeg:number'))fail('Secondary Surface Carve geometry placement is incomplete.');

if(!app.includes("import SurfaceCarvePanel from './lib/SurfaceCarvePanel.svelte'"))fail('Bearbeiten UI does not contain the Surface Carve panel.');
if(!app.includes("importSummary.kind==='step'}<button onclick={()=>appendOperation('surface-carve')"))fail('Surface Carve is not limited to STEP primary parts in the Bearbeiten add UI.');
if(!app.includes("operation.kind==='surface-carve'}<SurfaceCarvePanel"))fail('Surface Carve is not rendered as a separate Bearbeiten operation.');
if(!app.includes("extensions:['step','stp','dxf']"))fail('Primary Bauteil import no longer preserves STEP/STP/DXF boundary.');
if(app.includes("extensions:['step','stp','dxf','svg']")||app.includes("extensions:['svg'"))fail('Secondary decoration formats leaked into primary Bauteil import.');
if(!app.includes('createCamProjectV2'))fail('007D projects are not persisted as project format V2.');

if(!panel.includes("extensions:['dxf']"))fail('007D secondary geometry import is not explicitly DXF-only.');
if(!panel.includes("invoke<ImportSummary>('inspect_import'"))fail('Secondary geometry does not reuse the normalized importer.');
if(!panel.includes("imported.kind!=='dxf'||!imported.planarGeometry"))fail('Secondary import does not require normalized planar DXF geometry.');
if(!panel.includes('offsetX')||!panel.includes('offsetY')||!panel.includes('scale')||!panel.includes('rotationDeg'))fail('Surface Carve placement controls are incomplete.');
if(!panel.includes('Diese Geometrie gehört ausschließlich zur Surface-Carve-Operation'))fail('Bearbeiten-only ownership of secondary geometry is not explicit in the UI.');
if(!panel.includes("candidate.kind==='z-level-roughing'"))fail('Surface Carve UI does not reference an independent preceding Z-Level operation.');
if(!panel.includes("candidate.faceIds.includes(operation.faceId)"))fail('Surface Carve UI does not constrain the Z-Level source to the same face.');

if(!persistence.includes('CAM_PROJECT_VERSION=2'))fail('Project format was not advanced to V2.');
if(!persistence.includes('version:1')||!persistence.includes('version:2'))fail('Project persistence does not preserve V1 backward compatibility.');
if(!persistence.includes('migrateCamProject'))fail('Explicit V1 → V2 migration support is missing.');
if((persistence.match(/source:\{path:string;fileName:string\}/g)??[]).length<2)fail('Primary source contract was unexpectedly removed from project persistence.');

if(!active.includes("if(operation.kind==='surface-carve')return null"))fail('007D must not silently route Surface Carve through an unrelated production toolpath builder.');
if(!preflight.includes('Surface Carve 007D ist im Bearbeiten-Workflow konfigurierbar, aber noch nicht in den Produktions-Preflight/NC-Pfad verdrahtet.'))fail('007D production preflight is not fail-closed.');
if(!gcode.includes("operation.kind==='surface-carve'" )||!gcode.includes('Surface Carve 007D ist noch nicht für NC-Ausgabe freigegeben.'))fail('007D NC layer does not reject Surface Carve explicitly.');
if(gcode.includes('buildSurfaceCarveCanonicalToolpath')||gcode.includes('surfaceCarveOperationContract'))fail('007D prematurely wired Surface Carve projection into job G-code.');
if(post.includes("surface-carve")||post.includes('Surface Carve'))fail('007D prematurely introduced Surface Carve-specific postprocessor behavior.');
if(!rustImport.includes('"step"|"stp"')||!rustImport.includes('"dxf"'))fail('Primary importer no longer supports the established STEP/STP/DXF formats.');

console.log('007D contract PASS: Surface Carve is a distinct STEP-only Bearbeiten operation with operation-owned DXF geometry, placement and V2 persistence, while primary import remains STEP/STP/DXF and production NC stays explicitly fail-closed until projection wiring.');
