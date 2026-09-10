import fs from 'node:fs';

const job=fs.readFileSync('src/lib/jobGcode.ts','utf8');

const zLine="lines.push(`G0 Z${f3(firstStart.z)}`);";
const xyLine="lines.push(`G0 X${f3(firstStart.x)} Y${f3(firstStart.y)}`);";
const spindleLine="lines.push(`( Bearbeitung ${index+1}/${enabled.length} · ${label(operation)} · ${operationDisplayName(operation,index)} )`,`M3 S${Math.round(operation.spindleRpm)}`);";

const zIndex=job.indexOf(zLine);
const xyIndex=job.indexOf(xyLine);
const spindleIndex=job.indexOf(spindleLine);

const failures=[];
if(zIndex<0)failures.push('missing Z-only Safe-Z establishment');
if(xyIndex<0)failures.push('missing XY positioning to first safe anchor');
if(spindleIndex<0)failures.push('missing operation spindle start');
if(zIndex>=0&&xyIndex>=0&&!(zIndex<xyIndex))failures.push('XY positioning occurs before Safe-Z establishment');
if(xyIndex>=0&&spindleIndex>=0&&!(xyIndex<spindleIndex))failures.push('spindle/operation sequence begins before initial positioning');
if(job.includes('G0 X${f3(firstStart.x)} Y${f3(firstStart.y)} Z${f3(firstStart.z)}'))failures.push('initial entry must not use simultaneous XYZ rapid from unknown machine position');

if(failures.length){
  for(const failure of failures)console.error(`FAIL 004T-A fixture: ${failure}`);
  process.exit(1);
}
console.log('PASS 004T-A fixture: NC initial entry is Z-only Safe-Z, then XY positioning, then operation start.');
