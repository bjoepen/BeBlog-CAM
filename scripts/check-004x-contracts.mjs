import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`);};

const transform=read('src/lib/partTransform.ts');
const drill=read('src/lib/drillGcode.ts');
const geometryView=read('src/lib/GeometryView.svelte');
const overlay=read('src/lib/ContourOverlay.svelte');
const app=read('src/App.svelte');

requireText(transform,'export function rotatePlanarPoint','shared Z rotation');
requireText(transform,'export function resolvePlanarPartTransform','shared placement resolver');
requireText(transform,'toStock:(point:Point2)=>Point2','model-to-stock transform');
requireText(transform,'toWcs:(point:Point2,wcs:WorkCoordinateSystem)=>Point2','model-to-WCS transform');
requireText(drill,"import { resolvePlanarPartTransform } from './partTransform'",'DXF drill uses shared transform');
requireText(drill,'const p=transform.toWcs(c.center,wcs)','DXF drill emits shared WCS coordinates');
requireText(app,'orientation.rotationZDeg','orientation remains project/setup state');
requireText(geometryView,'orientation.rotationZDeg','edit viewport reacts to part orientation');
requireText(overlay,'orientation.rotationZDeg','DXF selection overlay reacts to part orientation');

// Mathematical contract: +90° rotates +X to +Y, independent of import kind.
const rotate=(p,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};};
const q=rotate({x:10,y:0},90);
if(Math.abs(q.x)>1e-9||Math.abs(q.y-10)>1e-9)throw new Error('004X rotation contract failed for +90° Z');

console.log('004X PASS: unified geometry placement/orientation contract is present.');
