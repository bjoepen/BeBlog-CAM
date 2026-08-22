import type { DrillOperation, ImportSummary, PartOrientation, PartPlacement, Point2, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { sampleCurve, type P2 } from './contourMath';

export type DrillPoint={id:number;x:number;y:number;sourceRadiusMm:number};
export type DrillGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;holeCount:number;passesPerHole:number;points:DrillPoint[]};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const rotate=(p:P2,deg:number):P2=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);

function placementTranslation(summary:ImportSummary,stock:StockDefinition,stockMode:StockMode,placement:PartPlacement,orientation:PartOrientation){
  const curves=summary.planarGeometry?.curves??[],all=curves.flatMap(c=>sampleCurve(c).map(p=>rotate(p,orientation.rotationZDeg)));if(!all.length)return null;
  const b=bounds(all),w=b.maxX-b.minX,h=b.maxY-b.minY;
  if(stockMode==='none')return{dx:-b.minX,dy:-b.minY,partBounds:{minX:0,maxX:w,minY:0,maxY:h}};
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,partBounds:{minX:tx+placement.offsetX,maxX:tx+w+placement.offsetX,minY:ty+placement.offsetY,maxY:ty+h+placement.offsetY}};
}
function wcsOrigin(stock:StockDefinition,stockMode:StockMode,wcs:WorkCoordinateSystem,partBounds:{minX:number;maxX:number;minY:number;maxY:number}){const b=stockMode==='none'?partBounds:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};return{x:wcs.x==='left'?b.minX:wcs.x==='right'?b.maxX:(b.minX+b.maxX)/2,y:wcs.y==='front'?b.minY:wcs.y==='back'?b.maxY:(b.minY+b.maxY)/2};}

function orderNearest(points:DrillPoint[],start:P2){const remaining=[...points],out:DrillPoint[]=[];let current=start;while(remaining.length){let best=0,bestD=Infinity;for(let i=0;i<remaining.length;i++){const d=dist(current,remaining[i]);if(d<bestD){bestD=d;best=i}}const next=remaining.splice(best,1)[0];out.push(next);current=next;}return out;}

export function validateDrillOperation(summary:ImportSummary,operation:DrillOperation){
  const errors:string[]=[],warnings:string[]=[];const curves=summary.planarGeometry?.curves??[];
  if(summary.kind!=='dxf')errors.push('Gate 9B unterstützt Bohren zunächst nur aus DXF.');
  if(!operation.curveIds.length)errors.push('Keine Bohrposition ausgewählt.');
  for(const id of operation.curveIds){const c=curves[id];if(!c||c.kind!=='circle')errors.push(`Geometrie ${id+1} ist kein nativer DXF-Kreis.`);}
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(operation.totalDepthMm<=0)errors.push('Bohrtiefe muss größer als 0 sein.');
  if(operation.stepDownMm<=0)errors.push('Zustellung muss größer als 0 sein.');
  if(operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');
  const passes=operation.stepDownMm>0?Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm)):0;
  return{ok:!errors.length,errors,warnings,passes,holeCount:operation.curveIds.length};
}

export function generateDrillGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation}):DrillGcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;const validation=validateDrillOperation(summary,operation),errors=[...validation.errors],warnings=[...validation.warnings];
  const fail=(extra:string[]=[]):DrillGcodeResult=>({ok:false,errors:[...errors,...extra],warnings,code:'',lineCount:0,holeCount:0,passesPerHole:validation.passes,points:[]});
  if(wcs.z!=='top')errors.push('WCS Unterseite ist für Bohren in Gate 9B noch nicht freigegeben.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Materialgrenzen können nur eingeschränkt geprüft werden.');
  if(stockMode!=='none'&&operation.totalDepthMm>stock.thickness)warnings.push(`Bohrtiefe ${f3(operation.totalDepthMm)} mm überschreitet die Rohlingdicke ${f3(stock.thickness)} mm.`);
  if(errors.length)return fail();
  const t=placementTranslation(summary,stock,stockMode,placement,orientation);if(!t)return fail(['Bauteilgeometrie konnte nicht transformiert werden.']);const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const transform=(p:Point2):P2=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx-origin.x,y:q.y+t.dy-origin.y}};
  const curves=summary.planarGeometry?.curves??[];const raw:DrillPoint[]=[];
  for(const id of operation.curveIds){const c=curves[id];if(!c||c.kind!=='circle')return fail([`Geometrie ${id+1} ist nicht mehr als DXF-Kreis verfügbar.`]);const p=transform(c.center);raw.push({id,x:p.x,y:p.y,sourceRadiusMm:c.radius});}
  const points=orderNearest(raw,{x:0,y:0});const lines:string[]=[];
  lines.push('( BeBlog CAM 001K )','( Operation: Bohren )','( Strategie: explizite G0/G1-Bohrbewegungen · keine Canned Cycles )',`( Werkzeug: ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`,`( ${points.length} Bohrposition${points.length===1?'':'en'} · Tiefe ${f3(operation.totalDepthMm)} mm · max. Zustellung ${f3(operation.stepDownMm)} mm )`,'G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
  for(let i=0;i<points.length;i++){
    const p=points[i];lines.push(`( Bohrung ${i+1}/${points.length} · DXF-Kreis ${p.id+1} )`,`G0 X${f3(p.x)} Y${f3(p.y)}`);
    for(let pass=1;pass<=validation.passes;pass++){const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);if(pass<validation.passes)lines.push('G0 Z0.000');}
    lines.push(`G0 Z${f3(operation.safeZMm)}`);
  }
  lines.push('M5','M30');const code=lines.join('\n')+'\n';return{ok:true,errors:[],warnings,code,lineCount:lines.length,holeCount:points.length,passesPerHole:validation.passes,points};
}
