import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir='.acceptance/008rw3';
fs.rmSync(outDir,{recursive:true,force:true});

execFileSync('pnpm',[
  'exec','tsc',
  'scripts/acceptance/008rw3-pocket-depth-linking.ts',
  '--outDir',outDir,
  '--module','commonjs',
  '--moduleResolution','node',
  '--target','es2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--allowJs',
  '--noEmitOnError','true',
],{stdio:'inherit'});

fs.writeFileSync(`${outDir}/package.json`,'{"type":"commonjs"}\n');
const output=execFileSync('node',[`${outDir}/scripts/acceptance/008rw3-pocket-depth-linking.js`],{encoding:'utf8'});
const result=JSON.parse(output);
let failed=false;
const check=(label,ok,detail='')=>{console.log(`${ok?'PASS':'FAIL'} 008-RW-003: ${label}${detail?` · ${detail}`:''}`);if(!ok)failed=true;};

for(const fixture of [result.auto,result.parallel]){
  check(`${fixture.strategy} production job generated`,fixture.job.ok,fixture.job.errors.join(' | '));
  check(`${fixture.strategy} keeps all three depth feeds`,fixture.depthFeeds>=3,`depth feeds=${fixture.depthFeeds}`);
  check(`${fixture.strategy} has only final full-XYZ Safe-Z rapid`,fixture.fullXyzSafeRapids===1,`Safe-Z rapids=${fixture.fullXyzSafeRapids}`);
}

check('fail-closed baseline still retracts between independent runs',result.safeMotion.failClosed.ok&&result.safeMotion.failClosed.rapidCount>=2,`rapids=${result.safeMotion.failClosed.rapidCount}`);
check('certified stay-down reduces rapid count',result.safeMotion.stayDown.ok&&result.safeMotion.stayDown.rapidCount<result.safeMotion.failClosed.rapidCount,`stay-down=${result.safeMotion.stayDown.rapidCount}, baseline=${result.safeMotion.failClosed.rapidCount}`);
check('certified stay-down contains no Safe-Z visit between depth runs',result.safeMotion.stayDown.ok&&!result.safeMotion.stayDown.motions.slice(0,-1).some(m=>m.end?.z===5),`motions=${result.safeMotion.stayDown.motions.length}`);
check('invalid open stay-down contract fails closed',!result.safeMotion.invalid.ok&&result.safeMotion.invalid.errors.some(error=>error.includes('retractAfter=false')),
  result.safeMotion.invalid.errors.join(' | '));

fs.rmSync(outDir,{recursive:true,force:true});
if(failed)process.exit(1);
console.log('PASS 008-RW-003 production acceptance: canonical depth linking survives 004T materialisation into the exact NC motion truth while ambiguous/unclosed links remain fail-closed.');
