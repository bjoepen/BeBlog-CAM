import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir='.acceptance/008b7';
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'package.json'),'{"type":"commonjs"}\n');

execFileSync('pnpm',['exec','tsc','scripts/acceptance/008b7-project-reload-determinism.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--allowJs','true','--noEmitOnError','true'],{stdio:'inherit'});
const output=execFileSync('node',[path.join(outDir,'scripts/acceptance/008b7-project-reload-determinism.js')],{encoding:'utf8'}).trim();
const result=JSON.parse(output);

function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}

pass('008B7 project serialization remains stable across reload',result.serializedStable===true);
pass('008B7 operation order and identities survive reload',result.operationIdsStable===true);
pass('008B7 baseline preflight is production-valid',result.before?.preflightLevel!=='fail'&&result.before?.preflightErrors?.length===0,JSON.stringify(result.before?.preflightErrors??[]));
pass('008B7 baseline NC generation succeeds',result.before?.jobOk===true&&result.before?.jobErrors?.length===0,JSON.stringify(result.before?.jobErrors??[]));
pass('008B7 preflight is deterministic after project reload',result.preflightEqual===true);
pass('008B7 NC output is byte-identical after project reload',result.ncEqual===true);
pass('008B7 production counts remain unchanged after reload',
  result.before?.enabledCount===result.after?.enabledCount&&
  result.before?.toolChanges===result.after?.toolChanges&&
  result.before?.lineCount===result.after?.lineCount&&
  result.before?.operationCount===result.after?.operationCount&&
  result.before?.toolChangeCount===result.after?.toolChangeCount
);

if(!process.exitCode)console.log('PASS 008B7 project reload determinism contract: an unchanged saved project and unchanged source reproduce the same validated Preflight truth and byte-identical NC output after reload.');