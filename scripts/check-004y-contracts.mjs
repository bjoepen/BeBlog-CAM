import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`);};

const canonical=read('src/lib/canonicalToolpath.ts');
const state=read('src/lib/pocketOperationState.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const step=read('src/lib/stepPocketOperation.ts');
const dxf=read('src/lib/pocketGcode.ts');
const persistence=read('src/lib/projectPersistence.ts');

requireText(canonical,'sourceOperationId?:string','canonical pocket source identity');
requireText(canonical,'targetKey?:string','canonical pocket target identity');
requireText(state,'export function buildPocketOperationState','shared pocket operation state');
requireText(state,'applyPocketStockAwareRoughing','shared state applies stock-aware roughing');
requireText(state,'applyPocketRestMachining','shared state applies rest machining');
requireText(state,'candidate.sourceOperationId===operation.restFromOperationId','rest source is selected by exact operation identity');
requireText(state,"previous.targetKey!==key",'rest machining requires identical pocket target');
requireText(state,'operation.tool.diameterMm+2*radialAllowance','radial pocket allowance changes roughing centerline');
requireText(state,'targetDepthMm-axialAllowance','axial pocket allowance leaves floor stock');
requireText(state,"entry:'plunge',stepDownMm:targetDepthMm,totalDepthMm:targetDepthMm",'finishing is a nominal single-depth pocket pass');
requireText(state,'repeatFinishRuns','finish pass count is materialized in canonical runs');
requireText(active,'buildPocketOperationState','Bearbeiten uses shared pocket state');
requireText(active,'previousToolpaths:args.previousToolpaths','Bearbeiten forwards prior canonical operations');
requireText(preflight,'applyPocketStockAwareRoughing','job preflight still validates stock-aware pocket path');
requireText(preflight,'applyPocketRestMachining','job preflight still validates rest-machining pocket path');
requireText(step,'targetDepth=Math.max(0,-faceMachineZ)','STEP pocket depth remains derived from selected BRep floor face');
requireText(dxf,'operation.totalDepthMm','DXF pocket depth remains operation-owned');
requireText(persistence,'operationsProject','004V persistence remains operation-project owned');

console.log('004Y PASS: pocket preview modifiers, allowances/finishing, exact rest source identity, depth-source split and persistence contract are present.');
