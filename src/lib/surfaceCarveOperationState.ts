import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { buildSurfaceCarveCanonicalToolpath } from './surfaceCarveCanonicalToolpath';
import type { Curve2, ImportSummary, PartOrientation, PartPlacement, StockDefinition, SurfaceCarveOperation, WorkCoordinateSystem } from './types';

type Args={summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:SurfaceCarveOperation};
export type SurfaceCarveOperationState={ok:boolean;toolpath:CanonicalToolpath|null;sourceToolpath:CanonicalToolpath|null;errors:string[];warnings:string[]};

const finite=(n:number)=>Number.isFinite(n);
const sampleCurve=(curve:Curve2):ToolpathPoint2[]=>{
  if(curve.kind==='line')return[curve.start,curve.end];
  if(curve.kind==='polyline')return curve.points;
  if(curve.kind==='circle')return Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:curve.center.x+Math.cos(a)*curve.radius,y:curve.center.y+Math.sin(a)*curve.radius}});
  if(curve.kind==='arc'){
    let a=curve.startAngleDeg,b=curve.endAngleDeg;while(b<a)b+=360;
    const steps=Math.max(8,Math.ceil(Math.abs(b-a)/5));
    return Array.from({length:steps+1},(_,i)=>{const r=(a+(b-a)*i/steps)*Math.PI/180;return{x:curve.center.x+Math.cos(r)*curve.radius,y:curve.center.y+Math.sin(r)*curve.radius}});
  }
  return[];
};

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem){
  return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0};
}

function placedStepTriangles(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation){
  const values=summary.brep?.displayVertices??[];
  const angle=orientation.rotationZDeg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const raw:{x:number;y:number;z:number}[]=[];
  for(let i=0;i+2<values.length;i+=3){const x=values[i],y=values[i+1],z=values[i+2];raw.push({x:x*c-y*s,y:x*s+y*c,z});}
  if(!raw.length)return[];
  const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),zs=raw.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),minZ=Math.min(...zs);
  const pw=maxX-minX,ph=maxY-minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-pw:(stock.width-pw)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-ph:(stock.height-ph)/2;
  const dx=tx-minX+placement.offsetX,dy=ty-minY+placement.offsetY;
  return raw.map(p=>({x:p.x+dx,y:p.y+dy,z:p.z-minZ+placement.offsetZ}));
}

function sourceToolpath(operation:SurfaceCarveOperation):CanonicalToolpath|null{
  const source=operation.geometrySource?.planarGeometry;
  if(!source)return null;
  const angle=operation.geometrySource!.rotationDeg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),scale=operation.geometrySource!.scale;
  const transform=(point:ToolpathPoint2):ToolpathPoint2=>({x:(point.x*c-point.y*s)*scale+operation.geometrySource!.offsetX,y:(point.x*s+point.y*c)*scale+operation.geometrySource!.offsetY});
  const baseRuns:{points:ToolpathPoint2[];segments:CanonicalToolpathSegment[]}[]=[];
  for(const curve of source.curves){
    const sampled=sampleCurve(curve).map(transform).filter(p=>finite(p.x)&&finite(p.y));
    if(sampled.length<2)continue;
    const segments:CanonicalToolpathSegment[]=sampled.slice(1).map((end,index)=>({kind:'line',start:sampled[index],end}));
    if(segments.length)baseRuns.push({points:sampled,segments});
  }
  if(!baseRuns.length)return null;
  const passCount=Math.max(1,Math.ceil(operation.totalDepthMm/Math.max(operation.stepDownMm,1e-9)));
  const runs:CanonicalToolpath['runs']=[];
  for(let pass=1;pass<=passCount;pass++){
    const z=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);
    for(const run of baseRuns)runs.push({kind:'cut',z,points:run.points,segments:run.segments,retractAfter:true});
  }
  return{version:1,operationKind:'carve',strategy:'carve',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:0,runs,sourceOperationId:operation.id,targetKey:`surface-face-${operation.faceId??'none'}`};
}

export function buildSurfaceCarveOperationState(args:Args):SurfaceCarveOperationState{
  const {summary,stock,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('Surface Carve benötigt ein STEP/STP-Ausgangsmodell.');
  if(operation.faceId===null)errors.push('Surface Carve benötigt eine STEP-Zielfläche.');
  if(!operation.geometrySource?.planarGeometry)errors.push('Surface Carve benötigt eine geladene normalisierte 2D-Geometrie.');
  if(!(operation.totalDepthMm>0&&operation.stepDownMm>0))errors.push('Surface Carve benötigt positive Gesamttiefe und Zustellung.');
  if(wcs.z!=='top')errors.push('Surface Carve ist aktuell nur mit Z-Null auf Rohlingoberseite freigegeben.');
  if(errors.length)return{ok:false,toolpath:null,sourceToolpath:null,errors,warnings};

  const planar=sourceToolpath(operation);
  if(!planar)return{ok:false,toolpath:null,sourceToolpath:null,errors:['Die sekundäre 2D-Geometrie enthält keine verwendbaren Carve-Kurven.'],warnings};
  const part=placedStepTriangles(summary,stock,placement,orientation);
  const target=buildCurvedFaceTarget(part,summary.brep?.displayFaceIds??[],[operation.faceId!]);
  errors.push(...target.errors);warnings.push(...target.warnings);
  if(!target.valid)return{ok:false,toolpath:null,sourceToolpath:planar,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  const result=buildSurfaceCarveCanonicalToolpath(planar,target,{origin:wcsOrigin(stock,wcs),safeZMm:operation.safeZMm,feedMmMin:operation.feedMmMin,plungeMmMin:operation.plungeMmMin,sampleSpacingMm:.35});
  errors.push(...result.errors);warnings.push(...result.warnings);
  return{ok:result.ok&&!!result.toolpath,toolpath:result.toolpath,sourceToolpath:planar,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
