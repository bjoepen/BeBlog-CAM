import type { ImportSummary,PartOrientation,PartPlacement,StockDefinition,WorkCoordinateSystem,ZLevelRoughingOperation } from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { P3 } from './stepView';
import { sliceTrianglesAtZ } from './zLevelSlice';
import { buildModelSliceRegions } from './modelSliceRegion';
import { buildRoughingRegions, type RoughingRegion } from './roughingRegion';
import { buildModelRoughingCanonicalToolpath } from './modelRoughingToolpath';
import { isPlanarRasterPointSafe } from './planarRasterKernel';

export type ModelRoughingOperationState={ok:boolean;toolpath:CanonicalToolpath|null;levelCount:number;roughingRegionCount:number;errors:string[];warnings:string[]};
const EPS=1e-6;
function rotate(p:P3,o:PartOrientation):P3{const a=o.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z}}
function bounds(p:P3[]){const x=p.map(q=>q.x),y=p.map(q=>q.y),z=p.map(q=>q.z);return{minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y),minZ:Math.min(...z),maxZ:Math.max(...z)}}
function placedPart(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;const v=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<v.length;i+=3)raw.push(rotate({x:v[i],y:v[i+1],z:v[i+2]},orientation));if(!raw.length)return null;
  const b=bounds(raw),pw=b.maxX-b.minX,ph=b.maxY-b.minY,tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-pw:(stock.width-pw)/2,ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-ph:(stock.height-ph)/2,dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(p=>({x:p.x+dx,y:p.y+dy,z:p.z-b.minZ+placement.offsetZ}));
}
function origin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0}}
function levels(top:number,bottom:number,step:number){const out:number[]=[];for(let z=top-step;z>bottom+1e-3;z-=step)out.push(z);const last=bottom+1e-3;if(last<top-EPS&&(out.length===0||Math.abs(out[out.length-1]-last)>1e-4))out.push(last);return out}
function islandLoops(i:RoughingRegion['islands'][number]){return[{points:i.outer},...i.holes.map(points=>({points}))]}
function safeInRegion(r:RoughingRegion,p:{x:number;y:number},d:number){return r.islands.some(i=>isPlanarRasterPointSafe(islandLoops(i),p,d))}
function accessErrors(toolpath:CanonicalToolpath,regions:RoughingRegion[],o:P3,d:number){
  const ordered=[...regions].filter(r=>r.valid).sort((a,b)=>b.z-a.z),sample=Math.max(.15,Math.min(.75,d/8));
  for(const run of toolpath.runs){const wz=run.z+o.z,higher=ordered.filter(r=>r.z>wz+1e-5);for(let i=1;i<run.points.length;i++){const a=run.points[i-1],b=run.points[i],dist=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(dist/sample));for(let k=0;k<=steps;k++){const t=k/steps,p={x:a.x+(b.x-a.x)*t+o.x,y:a.y+(b.y-a.y)*t+o.y},blocked=higher.find(r=>!safeInRegion(r,p,d));if(blocked)return[`Top-Zugänglichkeit verletzt: Bahn Z ${wz.toFixed(3)} mm bei X ${p.x.toFixed(3)} / Y ${p.y.toFixed(3)} mm ist durch Ebene Z ${blocked.z.toFixed(3)} mm blockiert.`]}}}
  return[];
}
export function buildModelRoughingOperationState(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ZLevelRoughingOperation;}):ModelRoughingOperationState{
  const {summary,stock,placement,orientation,wcs,operation}=args,errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('Modell-Schruppen benötigt ein STEP/BRep-Modell.');if(wcs.z!=='top')errors.push('Modell-Schruppen benötigt WCS Z auf der Rohlingoberseite.');if(operation.finishAllowanceMm>1e-9)errors.push('003C Modell-Schruppen unterstützt noch kein echtes 3D-Schlichtaufmaß. Schlichtaufmaß muss 0,000 mm sein.');if(!(operation.stepDownMm>0))errors.push('Zustellung muss größer als 0 sein.');
  if(errors.length)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors,warnings};
  const part=placedPart(summary,stock,placement,orientation);if(!part)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors:['STEP/BRep-Triangulation konnte nicht rekonstruiert werden.'],warnings};
  const b=bounds(part);if(b.minZ<-EPS||b.maxZ>stock.thickness+EPS)errors.push(`Bauteil Z ${b.minZ.toFixed(3)}…${b.maxZ.toFixed(3)} mm liegt nicht vollständig im Rohling 0…${stock.thickness.toFixed(3)} mm.`);
  const zs=levels(stock.thickness,b.minZ,operation.stepDownMm);if(!zs.length)errors.push('Keine Z-Level zwischen Rohlingoberseite und Modellunterkante vorhanden.');if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:0,errors,warnings};
  const model=buildModelSliceRegions(zs.map(z=>sliceTrianglesAtZ(part,z))),rough=buildRoughingRegions(model,{minX:0,minY:0,maxX:stock.width,maxY:stock.height}),invalid=rough.filter(r=>!r.valid);
  if(invalid.length){errors.push(`${invalid.length} Stock−Model-Ebene${invalid.length===1?' ist':'n sind'} ungültig.`);for(const r of invalid)for(const e of r.errors)errors.push(`Z ${r.z.toFixed(3)}: ${e}`)}
  if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings};
  const o=origin(stock,wcs),built=buildModelRoughingCanonicalToolpath(rough,operation.tool.diameterMm,operation.stepoverPercent,o);warnings.push(...built.warnings);errors.push(...built.errors);
  if(!built.ok||!built.toolpath)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  errors.push(...accessErrors(built.toolpath,rough,o,operation.tool.diameterMm));return{ok:errors.length===0,toolpath:errors.length?null:built.toolpath,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
