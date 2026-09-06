import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const step=read('src/lib/stepDrillOperation.ts');
const dxf=read('src/lib/drillGcode.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const job=read('src/lib/jobGcode.ts');
const persistence=read('src/lib/projectPersistence.ts');

const checks=[
  ['STEP drill path remains operation-owned and canonical',step.includes("operationKind:'drill'")&&step.includes('motions')&&active.includes('buildStepDrillOperationState')],
  ['STEP drill depth uses explicit operation totalDepthMm',step.includes('operation.totalDepthMm<=0')&&step.includes('requestedBottom')&&step.includes('operation.totalDepthMm>hole.depthMm')],
  ['STEP axial drilling requires tool diameter to match recognized hole diameter',step.includes('Axiales Bohren benötigt Werkzeug-Ø')&&step.includes('DIAMETER_EPS_MM')],
  ['STEP helix requires cutter smaller than recognized hole diameter',step.includes("operation.method==='helical-mill'")&&step.includes('kleiner als Bohrungs-Ø')],
  ['DXF axial drilling requires tool diameter to match circle target diameter',dxf.includes('Axiales Bohren benötigt Werkzeug-Ø')&&dxf.includes('DIAMETER_EPS_MM')],
  ['DXF helix keeps smaller-tool diameter contract',dxf.includes('muss kleiner als Bohrungs-Ø')&&dxf.includes('pathRadius')],
  ['peck / depth increment remains explicit through stepDownMm',step.includes('Math.ceil(depth/operation.stepDownMm)')&&dxf.includes('Math.ceil(operation.totalDepthMm/operation.stepDownMm)')],
  ['job NC still posts preflight canonical motions',job.includes('postCanonicalMachineMotions')&&job.includes('preflight!.toolpath!')],
  ['004V persistence still owns complete operations project without drill special case',persistence.includes('operationsProject:OperationsProject')],
];

let failed=false;
for(const [label,ok] of checks){
  console.log(`${ok?'PASS':'FAIL'} 004W: ${label}`);
  if(!ok)failed=true;
}
if(failed)process.exit(1);
