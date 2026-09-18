import fs from 'node:fs';

const source=fs.readFileSync('src/lib/partOrientation.ts','utf8');

const required=[
  'orientPoint3',
  'orientDirection3',
  'orientTuple3',
  'rotationXDeg',
  'rotationYDeg',
  'rotationZDeg',
  'X -> Y -> Z',
];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){
  console.error('FAIL 008D-A: missing orientation truth tokens:',missing.join(', '));
  process.exit(1);
}

const transpiled=source
  .replace(/^import type .*;\n/m,'')
  .replace(/export type .*;\n/g,'')
  .replace(/export function orientPoint3<[^>]+>\(point:T,orientation:PartOrientation\):T/,'function orientPoint3(point,orientation)')
  .replace(/export function orientDirection3\(direction:OrientationTuple3,orientation:PartOrientation\):OrientationTuple3/,'function orientDirection3(direction,orientation)')
  .replace(/export function orientTuple3\(point:OrientationTuple3,orientation:PartOrientation\):OrientationTuple3/,'function orientTuple3(point,orientation)')
  .replace(/const radians=\(degrees:number\)/,'const radians=(degrees)')
  .replace('return{...point,x:x3,y:y3,z:z2};','return{...point,x:x3,y:y3,z:z2};');

const moduleUrl='data:text/javascript;base64,'+Buffer.from(transpiled+'\nexport {orientPoint3,orientDirection3,orientTuple3};').toString('base64');
const {orientPoint3,orientDirection3,orientTuple3}=await import(moduleUrl);

const near=(a,b)=>Math.abs(a-b)<=1e-9;
const pointNear=(a,b)=>near(a.x,b.x)&&near(a.y,b.y)&&near(a.z,b.z);
const tupleNear=(a,b)=>a.length===b.length&&a.every((value,index)=>near(value,b[index]));
const o=(x=0,y=0,z=0)=>({rotationXDeg:x,rotationYDeg:y,rotationZDeg:z});
const checks=[
  ['identity point',pointNear(orientPoint3({x:1,y:2,z:3},o()),{x:1,y:2,z:3})],
  ['X +90 maps +Y to +Z',pointNear(orientPoint3({x:0,y:1,z:0},o(90,0,0)),{x:0,y:0,z:1})],
  ['X -90 maps +Z to +Y',pointNear(orientPoint3({x:0,y:0,z:1},o(-90,0,0)),{x:0,y:1,z:0})],
  ['Y +90 maps +Z to +X',pointNear(orientPoint3({x:0,y:0,z:1},o(0,90,0)),{x:1,y:0,z:0})],
  ['Y -90 maps +X to +Z',pointNear(orientPoint3({x:1,y:0,z:0},o(0,-90,0)),{x:0,y:0,z:1})],
  ['Z +90 maps +X to +Y',pointNear(orientPoint3({x:1,y:0,z:0},o(0,0,90)),{x:0,y:1,z:0})],
  ['Z -90 maps +Y to +X',pointNear(orientPoint3({x:0,y:1,z:0},o(0,0,-90)),{x:1,y:0,z:0})],
  ['fixed order X then Y then Z',pointNear(orientPoint3({x:0,y:1,z:0},o(90,90,0)),{x:1,y:0,z:0})],
  ['direction uses same rotation',tupleNear(orientDirection3([0,1,0],o(90,0,0)),[0,0,1])],
  ['tuple point uses same rotation',tupleNear(orientTuple3([0,0,1],o(0,90,0)),[1,0,0])],
];
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length){
  console.error('FAIL 008D-A orientation math:',failed.join(', '));
  process.exit(1);
}
console.log('PASS 008D-A: shared orientation truth preserves identity and applies tested X/Y/Z quarter-turns to points and directions in fixed X -> Y -> Z order.');
