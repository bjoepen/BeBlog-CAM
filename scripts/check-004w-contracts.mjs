import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const step=read('src/lib/stepDrillOperation.ts');
const dxf=read('src/lib/drillGcode.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const job=read('src/lib/jobGcode.ts');
const persistence=read('src/lib/projectPersistence.ts');
const app=read('src/App.svelte');
const operations=read('src/lib/operationsProject.ts');
const types=read('src/lib/types.ts');

const checks=[
  ['STEP drill path remains operation-owned and canonical',step.includes("operationKind:'drill'")&&step.includes('motions')&&active.includes('buildStepDrillOperationState')],
  ['manual STEP drill depth remains explicitly operation-owned',step.includes("(operation.depthMode??'manual')==='manual'")&&step.includes('operation.totalDepthMm>hole.depthMm')],
  ['STEP through drilling resolves stock bottom plus overcut',step.includes("depthMode??'manual')==='stock-bottom'")&&step.includes('-stock.thickness-(operation.overcutMm??0)')],
  ['DXF through drilling resolves stock thickness plus overcut',dxf.includes('resolvedDxfDrillDepth')&&dxf.includes('stock.thickness+overcut')],
  ['drill model persists depth mode and overcut',types.includes("DrillDepthMode='manual'|'stock-bottom'")&&types.includes('overcutMm?:number')],
  ['STEP axial drilling requires tool diameter to match recognized hole diameter',step.includes('Axiales Bohren benötigt Werkzeug-Ø')&&step.includes('DIAMETER_EPS_MM')],
  ['STEP helix requires cutter smaller than recognized hole diameter',step.includes("operation.method==='helical-mill'")&&step.includes('kleiner als Bohrungs-Ø')],
  ['DXF axial drilling requires tool diameter to match circle target diameter',dxf.includes('Axiales Bohren benötigt Werkzeug-Ø')&&dxf.includes('DIAMETER_EPS_MM')],
  ['DXF helix keeps smaller-tool diameter contract',dxf.includes('muss kleiner als Bohrungs-Ø')&&dxf.includes('pathRadius')],
  ['drill UI exposes axial and helical methods',app.includes('Axial bohren')&&app.includes('Helixfräsen')&&app.includes("updateDrill({method:'helical-mill'})")],
  ['drill UI exposes through-stock depth and overcut',app.includes('Durch Rohling')&&app.includes('Overcut unter Rohling')&&app.includes("updateDrill({depthMode:'stock-bottom'})")],
  ['operation kind changes synchronize the visible project name',operations.includes('operationName(next.kind')&&app.includes('const synced=operationsProject.operations.find')],
  ['STEP drill selection is counted in operation summary',operations.includes('stepHoleFeatureIds?.length')&&operations.includes("'STEP-Auswahl'")],
  ['active STEP drill canonical toolpath is routed to the 3D preview',app.includes("activeStep==='Bearbeiten'&&importSummary.kind==='step'&&activeCanonicalToolpath?[activeCanonicalToolpath]:[]")],
  ['peck / depth increment remains explicit through stepDownMm',step.includes('Math.ceil(depth/operation.stepDownMm)')&&dxf.includes('Math.ceil(targetDepthMm/operation.stepDownMm)')],
  ['job NC still posts preflight canonical motions',job.includes('postCanonicalMachineMotions')&&job.includes('preflight!.toolpath!')],
  ['004V persistence still owns complete operations project without drill special case',persistence.includes('operationsProject:OperationsProject')],
];

let failed=false;
for(const [label,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} 004W1: ${label}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
