import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const out='.acceptance/012a';
try{
  execFileSync('pnpm',['exec','tsc','scripts/acceptance/012a-step-contour-closure.ts','--outDir',out,'--module','commonjs','--moduleResolution','node','--target','es2022','--skipLibCheck','--noEmitOnError','true'],{stdio:'inherit'});
  fs.writeFileSync(out+'/package.json','{"type":"commonjs"}\n');
  execFileSync('node',[out+'/scripts/acceptance/012a-step-contour-closure.js'],{stdio:'inherit'});
}finally{fs.rmSync(out,{recursive:true,force:true});}
