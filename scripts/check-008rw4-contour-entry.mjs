import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir='.acceptance/008rw4';
fs.rmSync(outDir,{recursive:true,force:true});
execFileSync('pnpm',['exec','tsc','scripts/acceptance/008rw4-contour-entry.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--allowJs','--noEmitOnError','true'],{stdio:'inherit'});
fs.writeFileSync(`${outDir}/package.json`,'{"type":"commonjs"}\n');
const raw=execFileSync('node',[`${outDir}/scripts/acceptance/008rw4-contour-entry.js`],{encoding:'utf8'});
const result=JSON.parse(raw);
const fail=[];
if(!result.ok)fail.push(`004T rejected contour lead fixture: ${result.errors.join(' | ')}`);
const first=result.motions?.[0];
if(!first)fail.push('no materialized motion');
else{
  if(Math.abs(first.start.x-result.leadStart.x)>1e-9||Math.abs(first.start.y-result.leadStart.y)>1e-9||Math.abs(first.start.z-result.safeZMm)>1e-9)fail.push(`first safe anchor is not lead start: ${JSON.stringify(first.start)}`);
  if(Math.abs(first.start.x-result.contourStart.x)<1e-9&&Math.abs(first.start.y-result.contourStart.y)<1e-9)fail.push('first safe anchor still uses contour start');
}
const rapidViaContour=(result.motions??[]).some(m=>m.kind==='rapid3'&&Math.abs(m.end.x-result.contourStart.x)<1e-9&&Math.abs(m.end.y-result.contourStart.y)<1e-9&&Math.abs(m.end.z-result.safeZMm)<1e-9);
if(rapidViaContour)fail.push('materialized path still visits contour start on Safe-Z before lead entry');
fs.rmSync(outDir,{recursive:true,force:true});
if(fail.length){for(const message of fail)console.error(`FAIL 008-RW-004: ${message}`);process.exit(1);}
console.log('PASS 008-RW-004: explicit contour lead-in owns the Safe-Z approach anchor; no redundant Safe-Z visit to contour start is materialized.');
