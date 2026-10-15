import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const outDir='.acceptance/011d2';
try {
  execFileSync('pnpm',['exec','tsc','scripts/acceptance/011d2-engagement-transfer.ts','--outDir',outDir,'--module','commonjs','--moduleResolution','node','--target','es2022','--skipLibCheck','--noEmitOnError','true'],{stdio:'inherit'});
  fs.writeFileSync(outDir+'/package.json','{"type":"commonjs"}\n');
  execFileSync('node',[outDir+'/scripts/acceptance/011d2-engagement-transfer.js'],{stdio:'inherit'});
} finally { fs.rmSync(outDir,{recursive:true,force:true}); }
