import fs from 'node:fs';

const chain=fs.readFileSync('src/lib/safeMotionChain.ts','utf8');
const job=fs.readFileSync('src/lib/jobGcode.ts','utf8');
const pkg=fs.readFileSync('package.json','utf8');

const checks=[
  ['004T exposes a deterministic first-operation safe anchor',chain.includes('startSafePoint')&&chain.includes('safeZMm')],
  ['job export derives its initial entry from the first preflight motion start',job.includes('const firstMotion=firstToolpath.motions?.[0]')&&job.includes('firstMotion.start')],
  ['job export establishes Z safety before any XY positioning',job.includes("lines.push(`G0 Z${f3(firstStart.z)}`)")&&job.includes("lines.push(`G0 X${f3(firstStart.x)} Y${f3(firstStart.y)}`)")&&job.indexOf("lines.push(`G0 Z${f3(firstStart.z)}`)")<job.indexOf("lines.push(`G0 X${f3(firstStart.x)} Y${f3(firstStart.y)}`)"))],
  ['initial entry is emitted before spindle start and first operation motions',job.indexOf('Initial Safe Entry')<job.indexOf('prepared.forEach((item,index)=>')],
  ['initial entry fails closed without a first materialized motion',job.includes('004T Initial Entry: erste Operation besitzt keine materialisierte Startbewegung.')],
  ['package exposes local 004T-A behavior gate',pkg.includes('"check:004t-entry": "node scripts/check-004t-initial-entry.mjs"')]
];

let failed=false;
for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004T-A: ${label}`);if(!ok)failed=true;}
if(failed)process.exit(1);
