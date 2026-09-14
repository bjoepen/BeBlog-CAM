import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir='.acceptance/008rw6';
fs.rmSync(outDir,{recursive:true,force:true});
execFileSync('pnpm',['exec','tsc','scripts/acceptance/008rw6-contour-start-entry.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--allowJs','--noEmitOnError','true'],{stdio:'inherit'});
fs.writeFileSync(`${outDir}/package.json`,'{"type":"commonjs"}\n');
const raw=execFileSync('node',[`${outDir}/scripts/acceptance/008rw6-contour-start-entry.js`],{encoding:'utf8'});
const result=JSON.parse(raw),fail=[];
const close=(a,b)=>Math.abs(a-b)<=1e-6;
if(result.auto.errors.length)fail.push(`auto placement failed: ${result.auto.errors.join(' | ')}`);
if(!result.auto.start||!close(result.auto.start.x,20)||!close(result.auto.start.y,0))fail.push(`auto start is not midpoint of longest straight: ${JSON.stringify(result.auto.start)}`);
if(result.manual.errors.length)fail.push(`manual placement failed: ${result.manual.errors.join(' | ')}`);
if(result.manual.starts.length!==2||!result.manual.starts.every(p=>close(p.x,40)&&close(p.y,20)))fail.push(`manual start is not stable across depth levels: ${JSON.stringify(result.manual.starts)}`);
if(result.ramp.errors.length)fail.push(`ramp entry failed: ${result.ramp.errors.join(' | ')}`);
if(!result.ramp.safeOk)fail.push(`004T rejected ramp entry: ${result.ramp.safeErrors.join(' | ')}`);
if(result.ramp.entries.length!==2||result.ramp.entries.some(entry=>entry.length<3))fail.push('ramp entry did not materialize vertical approach, descent and cleanup return on each depth level');
for(const [index,entry] of result.ramp.entries.entries()){
  const first=entry[0],last=entry.at(-1),target=-(index+1)*.5;
  if(!first||!close(first.start.z,5))fail.push(`ramp ${index+1} does not own Safe-Z entry anchor`);
  if(!last||!close(last.end.x,40)||!close(last.end.y,20)||!close(last.end.z,target))fail.push(`ramp ${index+1} does not return to canonical start at target Z`);
}
if(!result.impossible.errors.length)fail.push('impossible ramp length did not fail closed');
fs.rmSync(outDir,{recursive:true,force:true});
if(fail.length){for(const message of fail)console.error(`FAIL 008-RW-006: ${message}`);process.exit(1);}
console.log('PASS 008-RW-006: contour start placement is stable across depth levels; auto prefers a long straight, manual placement is deterministic, ramp entry is canonical and insufficient ramp length fails closed.');
