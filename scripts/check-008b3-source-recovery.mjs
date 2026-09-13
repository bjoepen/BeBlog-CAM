import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir='.acceptance/008b3';
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'package.json'),'{"type":"commonjs"}\n');

execFileSync('pnpm',['exec','tsc','scripts/acceptance/008b3-source-recovery.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--noEmitOnError','true'],{stdio:'inherit'});

const output=execFileSync('node',[path.join(outDir,'scripts/acceptance/008b3-source-recovery.js')],{encoding:'utf8'}).trim();
const result=JSON.parse(output);

function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}

pass('008B3 existing source resolves directly',result.direct?.relocated===false&&result.direct?.path==='/old/location/008b3-reference.dxf');
pass('008B3 legacy source without fingerprint remains loadable',result.legacyDirect?.relocated===false&&result.legacyDirect?.path==='/old/location/legacy-reference.dxf');
pass('008B3 geometry identity mismatch fails closed',typeof result.identityMismatchError==='string'&&result.identityMismatchError.includes('seit dem Speichern verändert'));
pass('008B3 geometry identity mismatch does not open relocation flow',result.identityMismatchRelocateCalls===0);
pass('008B3 missing source fails closed',typeof result.missingError==='string'&&result.missingError.includes('Projektquelle nicht verfügbar'));
pass('008B3 moved source can be explicitly relocated',result.moved?.relocated===true&&result.moved?.path==='/new/location/008b3-reference.dxf');
pass('008B3 cancelled relocation fails closed',typeof result.cancelledError==='string'&&result.cancelledError.includes('keine Neuzuordnung gewählt'));
pass('008B3 wrong replacement filename is rejected',typeof result.wrongNameError==='string'&&result.wrongNameError.includes('Neuzuordnung abgelehnt'));

if(!process.exitCode){
  console.log('PASS 008B3 source recovery contract: legacy projects remain loadable, identity mismatches fail closed without misleading relocation, and genuinely missing sources can still be explicitly relocated.');
}
