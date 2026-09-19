import type { ImportSummary,PartOrientation,PartPlacement,StockDefinition,WorkCoordinateSystem,ZLevelRoughingOperation } from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import { orientPoint3 } from './partOrientation';
import type { P3 } from './stepView';
import { sliceTrianglesAtZ } from './zLevelSlice';
import { buildModelSliceRegions } from './modelSliceRegion';
import { buildRoughingRegions, type RoughingRegion } from './roughingRegion';
import { buildModelRoughingCanonicalToolpath } from './modelRoughingToolpath';
import { isPlanarRasterPointSafe } from './planarRasterKernel';
import type { ZLevelPerformanceProfile } from './zLevelPerformance';

export type ModelRoughingOperationState={ok:boolean;toolpath:CanonicalToolpath|null;levelCount:number;roughingRegionCount:number;errors:string[];warnings:string[]};
type XYBounds={minX:number;minY:number;maxX:number;maxY:number};
const EPS=1e-6;
function bounds(p:P3[]){const x=p.map(q=>q.x),y=p.map(q=>q.y),z=p.map(q=>q.z);return{minX:Math.min(...x),maxX:Math.max(...x),minY:Math.min(...y),maxY:Math.max(...y),minZ:Math.min(...z),maxZ:Math.max(...z)}}
function placedPart(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;const v=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<v.length;i+=3)raw.push(orientPoint3({x:v[i],y:v[i+1],z:v[i+2]},orientation));if(!raw.length)return null;
  const b=bounds(raw),pw=b.maxX-b.minX,ph=b.maxY-b.minY,tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-pw:(stock.width-pw)/2,ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-ph:(stock.height-ph)/2,dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(p=>({x:p.x+dx,y:p.y+dy,z:p.z-b.minZ+placement.offsetZ}));
}
function origin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0}}
function levels(top:number,bottom:number,step:number){const out:number[]=[];for(let z=top-step;z>bottom+1e-3;z-=step)out.push(z);const last=bottom+1e-3;if(last<top-EPS&&(out.length===0||Math.abs(out[out.length-1]-last)>1e-4))out.push(last);return out}
function selectedFaceBounds(part:P3[],faceIds:number[],selectedFaceIds:number[]):({xy:XYBounds;minZ:number;maxZ:number}|null){
  const selected=new Set(selectedFaceIds),points:P3[]=[];
  for(let t=0;t<faceIds.length&&t*3+2<part.length;t++)if(selected.has(faceIds[t]))points.push(part[t*3],part[t*3+1],part[t*3+2]);
  if(!points.length)return null;
  const b=bounds(points);
  return{xy:{minX:b.minX,minY:b.minY,maxX:b.maxX,maxY:b.maxY},minZ:b.minZ,maxZ:b.maxZ};
}
function clipSegmentToXY(a:{x:number;y:number},b:{x:number;y:number},r:XYBounds){
  const dx=b.x-a.x,dy=b.y-a.y,p=[-dx,dx,-dy,dy],q=[a.x-r.minX,r.maxX-a.x,a.y-r.minY,r.maxY-a.y];
  let u0=0,u1=1;
  for(let i=0;i<4;i++){
    if(Math.abs(p[i])<=EPS){if(q[i]<0)return null;continue}
    const t=q[i]/p[i];
    if(p[i]<0){if(t>u1)return null;u0=Math.max(u0,t)}else{if(t<u0)return null;u1=Math.min(u1,t)}
  }
  return[{x:a.x+u0*dx,y:a.y+u0*dy},{x:a.x+u1*dx,y:a.y+u1*dy}] as const;
}
function clipToolpathToXY(toolpath:CanonicalToolpath,b:XYBounds):CanonicalToolpath{
  const runs:CanonicalToolpath['runs']=[];
  for(const run of toolpath.runs){
    let current:typeof run.points=[];
    const flush=()=>{if(current.length>=2)runs.push({...run,points:current,retractAfter:true});current=[]};
    for(let i=1;i<run.points.length;i++){
      const clipped=clipSegmentToXY(run.points[i-1],run.points[i],b);
      if(!clipped){flush();continue}
      const [a,c]=clipped,last=current.at(-1);
      if(!last||Math.hypot(last.x-a.x,last.y-a.y)>1e-5){flush();current=[a]}
      if(Math.hypot(current.at(-1)!.x-c.x,current.at(-1)!.y-c.y)>EPS)current.push(c);
    }
    flush();
  }
  return{...toolpath,runs};
}
function islandLoops(i:RoughingRegion['islands'][number]){return[{points:i.outer},...i.holes.map(points=>({points}))]}
function safeInRegion(r:RoughingRegion,p:{x:number;y:number},d:number,profile?:ZLevelPerformanceProfile){return r.islands.some(i=>{if(profile)profile.accessibilityRegionTests++;return isPlanarRasterPointSafe(islandLoops(i),p,d,profile)})}
function accessErrors(toolpath:CanonicalToolpath,regions:RoughingRegion[],o:P3,d:number,profile?:ZLevelPerformanceProfile){
  const ordered=[...regions].filter(r=>r.valid).sort((a,b)=>b.z-a.z),sample=Math.max(.15,Math.min(.75,d/8));
  for(const run of toolpath.runs){const wz=run.z+o.z,higher=ordered.filter(r=>r.z>wz+1e-5);for(let i=1;i<run.points.length;i++){const a=run.points[i-1],b=run.points[i],dist=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(dist/sample));for(let k=0;k<=steps;k++){if(profile)profile.accessibilitySamples++;const t=k/steps,p={x:a.x+(b.x-a.x)*t+o.x,y:a.y+(b.y-a.y)*t+o.y},blocked=higher.find(r=>!safeInRegion(r,p,d,profile));if(blocked)return[`Top-Zugänglichkeit verletzt: Bahn Z ${wz.toFixed(3)} mm bei X ${p.x.toFixed(3)} / Y ${p.y.toFixed(3)} mm ist durch Ebene Z ${blocked.z.toFixed(3)} mm blockiert.`]}}}
  return[];
}
export function buildModelRoughingOperationState(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ZLevelRoughingOperation;profile?:ZLevelPerformanceProfile;scopeToSelectedFaces?:boolean;}):ModelRoughingOperationState{
  const {summary,stock,placement,orientation,wcs,operation,profile}=args,errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('Modell-Schruppen benötigt ein STEP/BRep-Modell.');if(wcs.z!=='top')errors.push('Modell-Schruppen benötigt WCS Z auf der Rohlingoberseite.');if(!(operation.finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');if(!(operation.stepDownMm>0))errors.push('Zustellung muss größer als 0 sein.');
  if(errors.length)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors,warnings};
  const part=placedPart(summary,stock,placement,orientation);if(!part)return{ok:false,toolpath:null,levelCount:0,roughingRegionCount:0,errors:['STEP/BRep-Triangulation konnte nicht rekonstruiert werden.'],warnings};
  const b=bounds(part);if(b.minZ<-EPS||b.maxZ>stock.thickness+EPS)errors.push(`Bauteil Z ${b.minZ.toFixed(3)}…${b.maxZ.toFixed(3)} mm liegt nicht vollständig im Rohling 0…${stock.thickness.toFixed(3)} mm.`);
  const faceIds=summary.brep?.displayFaceIds??[];
  const selected=args.scopeToSelectedFaces?selectedFaceBounds(part,faceIds,operation.faceIds):null;
  if(args.scopeToSelectedFaces&&!selected)errors.push('Gewählte STEP/BRep-Zielflächen konnten nicht als Z-Level-Bearbeitungsbereich rekonstruiert werden.');
  const allowance=Math.max(0,operation.finishAllowanceMm);
  const bottom=(selected?.minZ??b.minZ)+allowance;
  const zs=levels(stock.thickness,bottom,operation.stepDownMm);if(!zs.length)errors.push('Keine Z-Level zwischen Rohlingoberseite und Zielbereich vorhanden.');if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:0,errors,warnings};
  // 008H True Z-Level: each cutting plane is derived from an actual solid slice.
  // For stock allowance, sample the solid lower by the allowance. Together with
  // the enlarged XY clearance disk this forms a conservative 3D envelope around
  // the nominal model instead of a mere Z offset.
  const slices=zs.map(cutZ=>{const slice=sliceTrianglesAtZ(part,Math.max(b.minZ,cutZ-allowance),profile);return{...slice,z:cutZ}});
  const model=buildModelSliceRegions(slices),rough=buildRoughingRegions(model,{minX:0,minY:0,maxX:stock.width,maxY:stock.height}),invalid=rough.filter(r=>!r.valid);
  if(invalid.length){errors.push(`${invalid.length} Stock−Model-Ebene${invalid.length===1?' ist':'n sind'} ungültig.`);for(const r of invalid)for(const e of r.errors)errors.push(`Z ${r.z.toFixed(3)}: ${e}`)}
  if(errors.length)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings};
  const o=origin(stock,wcs),built=buildModelRoughingCanonicalToolpath(rough,operation.tool.diameterMm,operation.stepoverPercent,o,profile,allowance);warnings.push(...built.warnings);errors.push(...built.errors);
  if(!built.ok||!built.toolpath)return{ok:false,toolpath:null,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  let toolpath=built.toolpath;
  if(selected&&toolpath){
    // Canonical paths are first proven safe against the complete solid, then
    // restricted to the XY envelope of the selected manufacturing faces.
    const machineBounds={minX:selected.xy.minX-o.x,minY:selected.xy.minY-o.y,maxX:selected.xy.maxX-o.x,maxY:selected.xy.maxY-o.y};
    toolpath=clipToolpathToXY(toolpath,machineBounds);
    if(!toolpath.runs.length)errors.push('Im gewählten Face-Bereich blieb keine sichere True-Z-Level-Schruppbahn übrig.');
  }
  if(toolpath)errors.push(...accessErrors(toolpath,rough,o,operation.tool.diameterMm+2*allowance,profile));
  if(selected)warnings.push('008H: Ziel-Faces begrenzen den Bearbeitungsbereich; Kollisions- und Materialwahrheit stammt aus dem vollständigen STEP-Solid.');
  return{ok:errors.length===0,toolpath:errors.length?null:toolpath,levelCount:zs.length,roughingRegionCount:rough.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
