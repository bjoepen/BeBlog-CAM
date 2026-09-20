import fs from 'node:fs';

function read(path){return fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');}
function requireText(source,text,label){
  if(!source.includes(text))throw new Error(`008H-A5 contract failed: ${label}`);
}

const material=read('src/lib/threeDRoughingMaterialConnectivity.ts');
const operation=read('src/lib/threeDRoughingOperation.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');

requireText(material,"sample.state==='removable'","A5 may group only A4 REMOVABLE samples");
requireText(material,'const neighbours=[',"A5 connectivity must be explicit");
requireText(material,"UNRESOLVED-Sample","UNRESOLVED must remain a hard material barrier");
requireText(material,'No interpolation, region polygons,',"A5 non-manufacturing boundary comment missing");

for(const forbidden of ['RoughingRegion','buildPlanarRasterChains','CanonicalToolpath','CanonicalMachineMotion','ballnoseContactAt','endMillRoughingSafetyAt']){
  if(material.includes(forbidden))throw new Error(`008H-A5 contract failed: forbidden dependency ${forbidden}`);
}

requireText(operation,'toolpath:null;','3D roughing operation must remain non-manufacturing in A5');
requireText(active,"if(operation.kind==='3d-roughing')","3D roughing dispatch missing");
requireText(active,'return null;','A5 must not emit active canonical toolpath');

console.log('008H-A5 material connectivity contract PASS');
