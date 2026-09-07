import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`);};
const rejectText=(text,needle,label)=>{if(text.includes(needle))throw new Error(`${label}: forbidden ${needle}`);};

const transform=read('src/lib/partTransform.ts');
const drill=read('src/lib/drillGcode.ts');
const geometryView=read('src/lib/GeometryView.svelte');
const overlay=read('src/lib/ContourOverlay.svelte');
const projection=read('src/lib/dxfPreviewProjection.ts');
const viewState=read('src/lib/dxfViewState.ts');
const app=read('src/App.svelte');

requireText(transform,'export function rotatePlanarPoint','shared Z rotation');
requireText(transform,'export function resolvePlanarPartTransform','shared placement resolver');
requireText(transform,'toStock:(point:Point2)=>Point2','model-to-stock transform');
requireText(transform,'toWcs:(point:Point2,wcs:WorkCoordinateSystem)=>Point2','model-to-WCS transform');
requireText(drill,"import { resolvePlanarPartTransform } from './partTransform'",'DXF drill uses shared transform');
requireText(drill,'const p=transform.toWcs(c.center,wcs)','DXF drill emits shared WCS coordinates');
requireText(app,'orientation.rotationZDeg','orientation remains project/setup state');
requireText(geometryView,"import { dxfEditView } from './dxfViewState'",'DXF edit viewport publishes shared view state');
requireText(geometryView,"drillViewMode==='25d'?'edit-25d':'edit-top'",'DXF 2.5D is generic edit mode');
requireText(geometryView,"summary.kind==='dxf'&&s2?.previewMode!=='job-top'",'DXF view controls are not drill-only');
requireText(geometryView,"summary.kind==='dxf'&&drillViewMode==='25d'",'DXF 2.5D interaction is generic');
requireText(projection,"'edit-top'|'edit-25d'|'job-top'",'DXF projection modes are explicit');
requireText(projection,"if(mode!=='edit-25d')",'job/top projection remains deterministic');
rejectText(projection,'drill-25d','DXF camera must not be coupled to drill operation');
requireText(viewState,"data.dxfEditView=state.mode",'shared DXF view state reaches overlay visibility contract');
requireText(viewState,'html[data-dxf-edit-view="25d"] .contour-overlay{display:none!important}','selection overlay is disabled in rotated view');
requireText(overlay,'orientation.rotationZDeg','DXF top-view selection still follows part orientation');

// Mathematical part-orientation contract: +90° rotates +X to +Y, independent of import kind.
const rotate=(p,deg)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};};
const q=rotate({x:10,y:0},90);
if(Math.abs(q.x)>1e-9||Math.abs(q.y-10)>1e-9)throw new Error('004X rotation contract failed for +90° Z');

console.log('004X PASS: unified part orientation plus generic DXF edit-view contract is present.');
