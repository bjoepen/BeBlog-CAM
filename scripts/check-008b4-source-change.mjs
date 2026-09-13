import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir='.acceptance/008b4';
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'package.json'),'{"type":"commonjs"}\n');

execFileSync('pnpm',['exec','tsc','scripts/acceptance/008b4-source-change.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--esModuleInterop','--skipLibCheck','--noEmitOnError','true'],{stdio:'inherit'});

const output=execFileSync('node',[path.join(outDir,'scripts/acceptance/008b4-source-change.js')],{encoding:'utf8'}).trim();
const result=JSON.parse(output);
const rustLib=fs.readFileSync('src-tauri/src/lib.rs','utf8');
const rustImport=fs.readFileSync('src-tauri/src/import.rs','utf8');
const persistence=fs.readFileSync('src/lib/projectPersistence.ts','utf8');

function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}

pass('008B4 unchanged source identity is accepted',result.unchanged?.relocated===false);
pass('008B4 changed source with same filename fails closed',typeof result.changedError==='string'&&result.changedError.includes('seit dem Speichern verändert'));
pass('008B4 exact original can be explicitly relocated after changed source is detected',result.recovered?.relocated===true&&result.recovered?.path==='/archive/008b4-reference.dxf');
pass('008B4 project without source identity fails closed',typeof result.legacyError==='string'&&result.legacyError.includes('gespeicherte Geometrie-Identität fehlt'));
pass('008B4 changed relocated source is rejected',typeof result.changedReplacementError==='string'&&result.changedReplacementError.includes('seit dem Speichern verändert'));
pass('008B4 save path persists source identity',rustLib.includes('source.insert("geometryIdentity"')&&rustLib.includes('import::source_fingerprint'));
pass('008B4 import path exposes source fingerprint',rustImport.includes('pub source_fingerprint:String')&&rustImport.includes('src-v1:'));
pass('008B4 project schema carries optional source identity',persistence.includes('geometryIdentity?:string'));

if(!process.exitCode){
  console.log('PASS 008B4 source-change contract: project source identity is persisted at save time and verified before saved setup or operation state may be restored, so a same-named but changed CAD source cannot silently become a different machining job.');
}
