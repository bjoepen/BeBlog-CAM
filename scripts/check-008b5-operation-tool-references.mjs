import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir='.acceptance/008b5';
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'package.json'),'{"type":"commonjs"}\n');

execFileSync('pnpm',['exec','tsc','scripts/acceptance/008b5-operation-tool-references.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--noEmitOnError','true'],{stdio:'inherit'});
const output=execFileSync('node',[path.join(outDir,'scripts/acceptance/008b5-operation-tool-references.js')],{encoding:'utf8'}).trim();
const results=JSON.parse(output);
const byId=id=>results.find(entry=>entry.id===id);
function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}
pass('008B5 valid operation graph is accepted',byId('valid-project')?.rejected===false);
pass('008B5 missing or duplicate operation identities are rejected',byId('empty-operations')?.rejected&&byId('missing-operation-id')?.rejected&&byId('duplicate-operation-id')?.rejected);
pass('008B5 unknown operation kind is rejected',byId('unknown-operation-kind')?.rejected);
pass('008B5 missing or invalid tool identity is rejected',byId('missing-tool')?.rejected&&byId('missing-tool-id')?.rejected&&byId('invalid-tool-diameter')?.rejected);
pass('008B5 dangling active-operation reference is rejected',byId('dangling-active-operation')?.rejected&&byId('dangling-active-operation')?.error?.includes('aktive Bearbeitung'));
pass('008B5 dangling or self rest-machining reference is rejected',byId('dangling-rest-source')?.rejected&&byId('self-rest-source')?.rejected);
pass('008B5 rest-machining source must be an earlier pocket operation',byId('wrong-kind-rest-source')?.rejected&&byId('forward-rest-source')?.rejected);
if(!process.exitCode)console.log('PASS 008B5 project reference-integrity contract: invalid operation identities, tools and cross-operation references are rejected during project parsing before saved project state can be accepted.');
