import fs from 'node:fs';

const files=[
  'src/lib/GeometryView.svelte',
  'src/lib/stepContourOperation.ts',
  'src/lib/stepPocketOperation.ts',
  'src/lib/stepDrillOperation.ts',
  'src/lib/faceTargetOperation.ts',
  'src/lib/modelRoughingOperation.ts',
  'src/lib/curvedFaceRoughingOperation.ts',
  'src/lib/surfaceFinishingOperation.ts',
];
const contents=new Map(files.map(file=>[file,fs.readFileSync(file,'utf8')]));
const failures=[];
for(const [file,source] of contents){
  if(/function\s+rotateZ?\s*\(/.test(source))failures.push(`${file}: local rotate/rotateZ remains`);
  if(source.includes('keine X/Y-Kippung')||source.includes('ohne X/Y-Kippung'))failures.push(`${file}: obsolete X/Y fail-closed guard remains`);
}
for(const file of files.filter(file=>file!=='src/lib/GeometryView.svelte')){
  const source=contents.get(file);
  if(!source.includes('partOrientation')&&!source.includes('buildOrientedStepManufacturingFeatureSource'))failures.push(`${file}: not connected to shared orientation truth`);
}
const view=contents.get('src/lib/GeometryView.svelte');
for(const token of ['orientPoint3','buildOrientedStepManufacturingFeatureSource']){
  if(!view.includes(token))failures.push(`GeometryView missing ${token}`);
}
const app=fs.readFileSync('src/App.svelte','utf8');
for(const token of ["setModelUp(axis:'+Z'|'-Z'|'+X'|'-X'|'+Y'|'-Y')","setOrientation(next:PartOrientation)","resetOrientation()","orientation.rotationXDeg","orientation.rotationYDeg","+X oben","−Y oben"]){
  if(!app.includes(token))failures.push(`App orientation UX missing ${token}`);
}
const persistence=fs.readFileSync('src/lib/projectPersistence.ts','utf8');
for(const token of ['orientation:PartOrientation','orientation:clone(args.orientation)']){
  if(!persistence.includes(token))failures.push(`project roundtrip missing ${token}`);
}
if(failures.length){
  console.error('FAIL 008D-E regression contract:\n- '+failures.join('\n- '));
  process.exit(1);
}
console.log('PASS 008D-E: STEP consumers, viewport, setup UX and project persistence are connected to one XYZ orientation truth; obsolete local Z-only/X-Y guards are absent.');
