import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){
  if(!source.includes(text))throw new Error(`008H-A5 contract failed: ${label}`);
}

const material=read('src/lib/threeDRoughingMaterialConnectivity.ts');

requireText(material,"sample.state==='removable'","A5 may group only A4 REMOVABLE samples");
requireText(material,'const neighbours=[',"A5 connectivity must be explicit");
requireText(material,"UNRESOLVED-Sample","UNRESOLVED must remain a hard material barrier");
requireText(material,'No interpolation, region polygons,',"A5 non-manufacturing boundary comment missing");

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','CanonicalToolpath','CanonicalMachineMotion','ballnoseContactAt','endMillRoughingSafetyAt']){
  if(material.includes(forbidden))throw new Error(`008H-A5 contract failed: forbidden dependency ${forbidden}`);
}


console.log('008H-A5 material connectivity contract PASS');
