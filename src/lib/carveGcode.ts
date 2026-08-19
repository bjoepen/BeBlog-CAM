import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, CarveOperation, Point2 } from './types';
import { sampleCurve, type P2 } from './contourMath';
import { validateCarveOperation } from './carveMath';

export type CarveGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;passes:number;segmentCount:number;totalCenterlineLengthMm:number;rapidSequenceLengthMm:number;};

type Segment={id:number;start:P2;end:P2};
const rotate=(p:P2,deg:number):P2=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

function placementTranslation(summary:ImportSummary,stock:StockDefinition,stockMode:StockMode,placement:PartPlacement,orientation:PartOrientation){
  const curves=summary.planarGeometry?.curves??[],all=curves.flatMap(c=>sampleCurve(c).map(p=>rotate(p,orientation.rotationZDeg)));if(!all.length)return null;
  const b=bounds(all),w=b.maxX-b.minX,h=b.maxY-b.minY;
  if(stockMode==='none')return{dx:-b.minX,dy:-b.minY,partBounds:{minX:0,maxX:w,minY:0,maxY:h}};
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,partBounds:{minX:tx+placement.offsetX,maxX:tx+w+placement.offsetX,minY:ty+placement.offsetY,maxY:ty+h+placement.offsetY}};
}
function wcsOrigin(stock:StockDefinition,stockMode:StockMode,wcs:WorkCoordinateSystem,partBounds:{minX:number;maxX:number;minY:number;maxY:number}){const b=stockMode==='none'?partBounds:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};return{x:wcs.x==='left'?b.minX:wcs.x==='right'?b.maxX:(b.minX+b.maxX)/2,y:wcs.y==='front'?b.minY:wcs.y==='back'?b.maxY:(b.minY+b.maxY)/2};}

/** Nearest-neighbour ordering is only used for safe-Z positioning. Each CAD line stays geometrically unchanged; it may only be traversed in the reverse direction. */
function orderSegmentsNearest(segments:Segment[],start:P2){
  const remaining=[...segments],ordered:Segment[]=[];let current=start,rapid=0;
  while(remaining.length){let bestIndex=0,bestReverse=false,best=Infinity;for(let i=0;i<remaining.length;i++){const a=dist(current,remaining[i].start),b=dist(current,remaining[i].end);if(a<best){best=a;bestIndex=i;bestReverse=false}if(b<best){best=b;bestIndex=i;bestReverse=true}}
    const chosen=remaining.splice(bestIndex,1)[0],oriented=bestReverse?{...chosen,start:chosen.end,end:chosen.start}:chosen;rapid+=best;ordered.push(oriented);current=oriented.end;
  }
  return{ordered,rapid};
}

export function generateCarveGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:CarveOperation}):CarveGcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args,validation=validateCarveOperation(summary,operation),errors=[...validation.errors],warnings=[...validation.warnings];
  const fail=(extra:string[]=[]):CarveGcodeResult=>({ok:false,errors:[...errors,...extra],warnings,code:'',lineCount:0,passes:validation.passes,segmentCount:validation.segments.length,totalCenterlineLengthMm:validation.totalLengthMm,rapidSequenceLengthMm:0});
  if(wcs.z!=='top')errors.push('WCS Unterseite ist für Carve in 001H noch gesperrt.');if(stockMode==='none')warnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.');if(errors.length)return fail();
  const t=placementTranslation(summary,stock,stockMode,placement,orientation);if(!t)return fail(['Bauteilgeometrie konnte nicht transformiert werden.']);const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const transform=(p:Point2):P2=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx-origin.x,y:q.y+t.dy-origin.y}};
  const curves=summary.planarGeometry?.curves??[];const segments:Segment[]=[];for(const checked of validation.segments){const curve=curves[checked.id];if(!curve||curve.kind!=='line')return fail([`Geometrie ${checked.id+1} ist nicht mehr als DXF-Linie verfügbar.`]);segments.push({id:checked.id,start:transform(curve.start),end:transform(curve.end)});}
  const start={x:0,y:0},ordered=orderSegmentsNearest(segments,start),lines:string[]=[];
  lines.push('( BeBlog CAM 001H )','( Carve · DXF-Centerlines · kein seitlicher Werkzeugradius-Offset )',`( ${segments.length} Linien · Werkzeug Ø${f3(operation.tool.diameterMm)} mm )`,'( Sichere Segmentwechsel ausschliesslich auf Sicherheits-Z )','G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
  const passes=Math.max(1,validation.passes);
  for(let pass=1;pass<=passes;pass++){
    const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);lines.push(`( Zustellung ${pass}/${passes} · Z${f3(depth)} )`);
    for(const segment of ordered.ordered){lines.push(`G0 Z${f3(operation.safeZMm)}`,`G0 X${f3(segment.start.x)} Y${f3(segment.start.y)}`,`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`,`G1 X${f3(segment.end.x)} Y${f3(segment.end.y)} F${Math.round(operation.feedMmMin)}`,`G0 Z${f3(operation.safeZMm)}`);}
  }
  lines.push('M5',`G0 Z${f3(operation.safeZMm)}`,'M30');const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings,code,lineCount:lines.length,passes,segmentCount:segments.length,totalCenterlineLengthMm:validation.totalLengthMm,rapidSequenceLengthMm:ordered.rapid};
}
