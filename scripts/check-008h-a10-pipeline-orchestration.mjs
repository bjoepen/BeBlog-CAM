import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(source,text,label)=>{if(!source.includes(text))throw new Error(`008H-A10 contract failed: ${label}`);};

const a10=read('src/lib/threeDRoughingPipeline.ts');
const operation=read('src/lib/threeDRoughingOperation.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');

requireText(a10,'operation.tool.diameterMm*operation.stepoverPercent/100','A4 grid step must derive from diameter × stepover');
requireText(a10,'THREE_D_ROUGHING_SEGMENT_VALIDATION_STEP_MM=.25','A6 segment validation must remain capped at 0.25 mm');
for(const stage of [
  'buildThreeDRoughingZLevelSchedule',
  'buildThreeDRoughingLevelEligibility',
  'buildThreeDRoughingMaterialConnectivity',
  'buildThreeDRoughingSafeChains',
  'buildThreeDRoughingCanonicalSafeEdges',
  'assembleThreeDRoughingCanonicalLevels',
])requireText(a10,stage,`missing approved orchestration stage ${stage}`);

requireText(a10,'if(!safe.chains.length)','valid empty levels must be skipped before A7');
requireText(a10,'if(!canonicalLevels.length)','all-empty schedules must not manufacture a toolpath');
requireText(a10,'toolpath:null','all-empty result must remain non-manufacturing');
requireText(a10,'No proven cut is not an error; unproven','empty-vs-unproven invariant missing');

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','rapid3','line3','arc3','retractAfter:false']){
  if(a10.includes(forbidden))throw new Error(`008H-A10 contract failed: forbidden shortcut ${forbidden}`);
}

requireText(operation,'toolpath:null;','A10 must not open operation manufacturing state');
requireText(active,"if(operation.kind==='3d-roughing')",'3D roughing active dispatch missing');
requireText(active,'return null;','A10 must keep active production dispatch locked');
requireText(preflight,'Der 3D-Schrupp-Kernel ist noch nicht freigegeben','A10 must retain preflight manufacturing lock');
requireText(gcode,'3D Schruppen besitzt noch keinen freigegebenen Manufacturing-Toolpath','A10 must retain direct G-code lock');

console.log('008H-A10 3D roughing pipeline orchestration contract PASS');
