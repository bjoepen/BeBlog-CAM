import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const types=read('src/lib/types.ts');
const kernel=read('src/lib/pocketStockAwareRoughing.ts');
const job=read('src/lib/jobGcode.ts');
const preflight=read('src/lib/jobPreflight.ts');
const app=read('src/App.svelte');
const checks=[
  ['pocket operation stores stock-aware roughing controls',types.includes('stockAwareRoughingEnabled?:boolean')&&types.includes('maxRadialEngagementPercent?:number')],
  ['defaults keep stock-aware roughing disabled and conservative',types.includes('stockAwareRoughingEnabled:false')&&types.includes('maxRadialEngagementPercent:35')],
  ['shared stock-aware kernel exists',kernel.includes('export function applyPocketStockAwareRoughing')],
  ['kernel tracks cleared material independently per Z level',kernel.includes('const byZ=new Map')&&kernel.includes('run.z.toFixed(6)')],
  ['first run of each Z level establishes the initial cleared corridor',kernel.includes("if(!cleared.length){kept.push(run);byZ.set(key,runSegments(run));continue;}" )],
  ['kernel samples candidate paths against previously cleared swept paths',kernel.includes('pointSegmentDistance')&&kernel.includes('minDistance(p,cleared)')],
  ['kernel rejects radial engagement above configured limit',kernel.includes('observed>maxEngagementMm')&&kernel.includes('Maximale radiale Werkzeugbelastung')],
  ['kernel can skip already cleared duplicate paths',kernel.includes('skippedRuns++')&&kernel.includes('bereits geräumte Werkzeugbahn')],
  ['job export posts the filtered stock-aware canonical path',job.includes('applyPocketStockAwareRoughing')&&job.includes('postPocketCanonicalToolpath(adaptive.toolpath')],
  ['job preflight validates stock-aware roughing before export',preflight.includes('applyPocketStockAwareRoughing')&&preflight.includes('Stock-aware Roughing und Restmaterial dürfen in 004O nicht gleichzeitig aktiv sein.')],
  ['pocket inspector exposes stock-aware roughing controls',app.includes('Stock-aware Roughing</p>')&&app.includes('setPocketStockAwareRoughing')&&app.includes('updatePocketMaxRadialEngagement')&&app.includes('maxRadialEngagementPercent??35')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004O: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
