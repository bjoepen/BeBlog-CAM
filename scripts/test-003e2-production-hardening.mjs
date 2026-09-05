import fs from 'node:fs';
import { toolIdentityKey, samePhysicalTool } from '../src/lib/toolIdentity.js';

let failures=0;
function check(condition,message){
  if(condition)console.log(`PASS 003E2: ${message}`);
  else{
    console.error(`FAIL 003E2: ${message}`);
    failures++;
  }
}

const endMill={
  tool:{id:'tool-3mm-end',name:'3 mm',kind:'end-mill',diameterMm:3},
};
const ballNose={
  tool:{id:'tool-3mm-ball',name:'3 mm',kind:'ball-nose',diameterMm:3},
};
const clonedEndMill={
  tool:{id:'tool-3mm-end',name:'3 mm',kind:'end-mill',diameterMm:3},
};
const inconsistentSameId={
  tool:{id:'tool-3mm-end',name:'3 mm',kind:'ball-nose',diameterMm:3},
};

check(
  toolIdentityKey(endMill)!==toolIdentityKey(ballNose),
  'same name and diameter but different physical tool/kind requires tool change',
);
check(
  samePhysicalTool(endMill,clonedEndMill),
  'same library ID, kind and diameter remains the same physical tool',
);
check(
  !samePhysicalTool(endMill,inconsistentSameId),
  'inconsistent kind on same tool ID cannot silently suppress tool change',
);

const preflight=fs.readFileSync('src/lib/jobPreflight.ts','utf8');
const job=fs.readFileSync('src/lib/jobGcode.ts','utf8');
const panel=fs.readFileSync('src/lib/JobGCodePanel.svelte','utf8');
const app=fs.readFileSync('src/App.svelte','utf8');

check(
  preflight.includes("import { toolIdentityKey } from './toolIdentity.js';") &&
  preflight.includes('const toolKey=(op:CamOperation)=>toolIdentityKey(op);'),
  'Preflight tool-change count uses shared physical-tool identity',
);
check(
  job.includes("import { toolIdentityKey } from './toolIdentity.js';") &&
  job.includes('const toolKey=(op:CamOperation)=>toolIdentityKey(op);'),
  'Gesamtjob tool-change emission uses the same physical-tool identity',
);
check(
  job.includes("import { validateJob } from './jobPreflight';") &&
  job.includes("if(preflight.level==='fail')") &&
  job.includes('Gesamtjob ist durch den Preflight nicht freigegeben.'),
  'Gesamtjob generator has a hard Preflight FAIL release gate',
);
check(
  panel.includes('Derselbe Preflight-Vertrag aus „Prüfen“ hat keinen FAIL geliefert.'),
  'Fräsen UI communicates the shared Preflight release contract',
);
check(
  !app.includes("import SurfaceFinishingGCodePanel from") &&
  !app.includes("import FaceTargetGCodePanel from") &&
  app.includes("import JobGCodePanel from"),
  'App uses Gesamtjob as primary G-code release without stale single-operation imports',
);

if(failures){
  console.error(`003E2 failed with ${failures} regression(s).`);
  process.exit(1);
}
console.log('PASS: 003E2 Production Hardening regression suite.');
