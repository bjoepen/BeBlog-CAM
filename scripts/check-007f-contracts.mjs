import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const exists=path=>fs.existsSync(path);
const app=read('src/App.svelte');
const main=read('src/main.ts');
const types=read('src/lib/types.ts');
const operations=read('src/lib/operationsProject.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const persistence=read('src/lib/projectPersistence.ts');
const projection=read('src/lib/surfaceCarveProjection.ts');
const canonical=read('src/lib/surfaceCarveCanonicalToolpath.ts');
const fail=message=>{console.error(`007F cleanup FAIL: ${message}`);process.exit(1)};

for(const [name,content] of [['App',app],['types',types],['operations',operations],['active toolpath',active],['preflight',preflight],['job gcode',gcode],['persistence',persistence]]){
  if(content.includes('surface-carve')||content.includes('SurfaceCarve')||content.includes('Surface Carve'))fail(`${name} still exposes Surface Carve as a product feature.`);
}

if(exists('src/lib/SurfaceCarvePanel.svelte'))fail('Surface Carve Bearbeiten panel still exists.');
if(exists('src/lib/surfaceCarveOperationContract.ts'))fail('Surface Carve product operation contract still exists.');
if(exists('scripts/check-007c-contracts.mjs')||exists('scripts/check-007d-contracts.mjs'))fail('Retired 007C/007D product gates still exist.');
if(exists('docs/BUILD-007C.md')||exists('docs/BUILD-007D.md'))fail('Retired 007C/007D product build docs still exist.');

if(!types.includes("kind:'carve'"))fail('Ordinary Carve was removed during cleanup.');
if(!types.includes("kind:'z-level-roughing'"))fail('Z-Level roughing was removed during cleanup.');
if(!app.includes("extensions:['step','stp','dxf']"))fail('Primary Bauteil import no longer preserves STEP/STP/DXF.');
if(!persistence.includes('CAM_PROJECT_VERSION=1'))fail('Cleanup did not return persistence to the post-007B product contract.');

if(!projection.includes('projectCarveToolpathToSurface'))fail('007A experimental projection helper was unexpectedly removed.');
if(!canonical.includes('buildSurfaceCarveCanonicalToolpath'))fail('007B experimental canonical helper was unexpectedly removed.');
if(app.includes('surfaceCarveProjection')||active.includes('buildSurfaceCarveCanonicalToolpath')||preflight.includes('buildSurfaceCarveCanonicalToolpath')||gcode.includes('buildSurfaceCarveCanonicalToolpath'))fail('Experimental 007A/007B code leaked back into the product pipeline.');

if(!main.includes('syncRetiredExperimentalControls'))fail('Retired experimental STEP control cleanup is missing.');
if(!main.includes("button.textContent?.trim() === 'Gekrümmte Zielfläche'"))fail('Gekrümmte Zielfläche remains product-facing.');

console.log('007F cleanup PASS: Surface Carve product/UI/persistence integration is removed; the retired curved-target control is not product-facing; ordinary Carve and Z-Level remain; 007A/007B survive only as isolated experimental research helpers.');
