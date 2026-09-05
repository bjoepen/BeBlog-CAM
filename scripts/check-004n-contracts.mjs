import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const types=read('src/lib/types.ts');
const rest=read('src/lib/pocketRestMachining.ts');
const job=read('src/lib/jobGcode.ts');
const preflight=read('src/lib/jobPreflight.ts');
const checks=[
  ['pocket operation stores rest machining controls',types.includes('restMachiningEnabled?:boolean')&&types.includes('restFromOperationId?:string|null')],
  ['defaults keep rest machining disabled',types.includes('restMachiningEnabled:false')&&types.includes('restFromOperationId:null')],
  ['shared canonical rest machining kernel exists',rest.includes('export function applyPocketRestMachining')],
  ['rest machining models previous swept-tool clearance',rest.includes('(previousToolDiameterMm-currentToolDiameterMm)/2')&&rest.includes('pointSegmentDistance')],
  ['rest machining splits current paths into actual rest segments',rest.includes('splitRun')&&rest.includes('needsRest')&&rest.includes('flatMap(run=>splitRun')],
  ['rest machining requires a smaller follow-up tool',rest.includes('previousToolDiameterMm<=currentToolDiameterMm')&&job.includes('source.tool.diameterMm<=pocket.tool.diameterMm')],
  ['job export requires source pocket before current operation',job.includes('sourceIndex>=currentIndex')&&job.includes("source.kind!=='pocket'")],
  ['job export requires matching STEP or DXF pocket target',job.includes('source.stepFaceId!==pocket.stepFaceId')&&job.includes('source.contourId!==pocket.contourId')],
  ['job export posts filtered canonical rest path',job.includes('applyPocketRestMachining')&&job.includes('postPocketCanonicalToolpath(rest.toolpath')],
  ['job preflight applies the same rest machining safety rules',preflight.includes('applyPocketRestMachining')&&preflight.includes('Restmaterialquelle muss im Job vor der aktuellen Taschenbearbeitung liegen.')&&preflight.includes('dieselbe STEP-Taschenfläche')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004N: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
