import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const app=read('src/App.svelte');
const checks=[
  ['contour operation stores lead mode and lengths',read('src/lib/types.ts').includes("leadMode?:ContourLeadMode")&&read('src/lib/types.ts').includes('leadInLengthMm?:number')&&read('src/lib/types.ts').includes('leadOutLengthMm?:number')],
  ['canonical run owns explicit exit segments',read('src/lib/canonicalToolpath.ts').includes('exitSegments?:CanonicalSpatialSegment[]')],
  ['shared canonical lead transformer exists',read('src/lib/contourLeads.ts').includes('export function applyContourLeads')],
  ['DXF contour applies tabs before shared leads',read('src/lib/gcode.ts').indexOf('applyContourTabs')<read('src/lib/gcode.ts').lastIndexOf('applyContourLeads')],
  ['STEP contour applies tabs before shared leads',read('src/lib/stepContourOperation.ts').indexOf('applyContourTabs')<read('src/lib/stepContourOperation.ts').lastIndexOf('applyContourLeads')],
  ['canonical poster emits entry and exit segments',read('src/lib/contourCanonicalToolpath.ts').includes('run.entrySegments??[]')&&read('src/lib/contourCanonicalToolpath.ts').includes('run.exitSegments??[]')],
  ['004K remains closed-contour only',read('src/lib/contourLeads.ts').includes("operation.topology!=='closed'")],
  ['contour inspector exposes lead mode',app.includes('Ein-/Ausfahrt')&&app.includes("leadMode:'line'")],
  ['contour inspector exposes lead lengths',app.includes('updateContourLeadInLength')&&app.includes('updateContourLeadOutLength')&&app.includes('leadInLengthMm??3')&&app.includes('leadOutLengthMm??3')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004K: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
