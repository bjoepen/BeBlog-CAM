import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{
  if(!condition){
    console.error(`FAIL 003E: ${message}`);
    process.exitCode=1;
  }else{
    console.log(`PASS 003E: ${message}`);
  }
};

const operations=read('src/lib/operationsProject.ts');
assert(
  operations.includes("if(kind==='surface-finishing') return {...defaultSurfaceFinishingOperation"),
  "createOperation(surface-finishing) has an explicit factory branch"
);

const zlevel=read('src/lib/zLevelOperationState.ts');
assert(
  zlevel.includes("buildCurvedFaceRoughingOperationState"),
  "Z-Level operation state owns the curved-face strategy"
);
assert(
  zlevel.includes("targetKind:'curved-face'"),
  "Z-Level state identifies curved Face Targets"
);

const active=read('src/lib/activeCanonicalToolpath.ts');
assert(
  active.includes("buildZLevelOperationState") &&
  !active.includes("if((operation.roughingMode??'face-target')!=='model')return null"),
  "active canonical Z-Level path no longer excludes Face Targets"
);

if(process.exitCode)process.exit(process.exitCode);
