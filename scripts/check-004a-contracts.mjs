import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const assert=(condition,message)=>{
  if(!condition){
    console.error(`FAIL 004A: ${message}`);
    process.exitCode=1;
  }else{
    console.log(`PASS 004A: ${message}`);
  }
};

const bridge=read('src-tauri/native/occt_bridge.cpp');
assert(
  bridge.includes('manufacturingFaces')&&
  bridge.includes('axisOrigin')&&
  bridge.includes('axisDirection')&&
  bridge.includes('radiusMm')&&
  bridge.includes('normal'),
  'native OCCT bridge exports exact planar/cylindrical face semantics'
);
assert(
  bridge.includes('displayEdges')&&bridge.includes('Manufacturing Faces'),
  'display geometry remains explicitly separate from manufacturing semantics'
);

const rust=read('src-tauri/src/occt.rs');
assert(
  rust.includes('pub manufacturing_faces: Vec<ManufacturingFaceSummary>')&&
  rust.includes('pub struct ManufacturingFaceSummary'),
  'Rust import boundary owns typed manufacturing-face payload'
);
assert(
  rust.includes('assert_eq!(summary.manufacturing_faces.len(), summary.faces)'),
  'native STEP fixture requires one manufacturing record per BRep face'
);

const feature=read('src/lib/stepManufacturingFeatures.ts');
assert(
  feature.includes("source:'step-brep'")&&feature.includes('exactBrep:true'),
  'frontend manufacturing source is explicitly native STEP/BRep'
);
assert(
  feature.includes('planarFaces')&&feature.includes('cylindricalFaces'),
  'manufacturing source exposes analytic planar and cylindrical candidates'
);
assert(
  feature.includes('does NOT classify holes')&&
  !feature.includes('buildHoleFeature')&&
  !feature.includes('buildPocketFeature'),
  '004A does not prematurely create higher-level machining features'
);

if(process.exitCode)process.exit(process.exitCode);
