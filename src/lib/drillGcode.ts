import type { DrillOperation, ImportSummary, PartOrientation, PartPlacement, Point2, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { sampleCurve, type P2 } from './contourMath';
import { buildHelicalDescent } from './helicalMotion';

export type DrillPoint={id:number;x:number;y:number;sourceRadiusMm:number};
export type DrillGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;holeCount:number;passesPerHole:number;points:DrillPoint[];method:'drill'|'helical-mill'};

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
  if(summary.kind!=='dxf')errors.push('001V unterstützt Bohren und Helixfräsen zunächst nur aus DXF.');
  if(!operation.curveIds.length)errors.push('Keine Bohrposition ausgewählt.');
  for(const id of operation.curveIds){const c=curves[id];if(!c||c.kind!=='circle')errors.push(`Geometrie ${id+1} ist kein nativer DXF-Kreis.`);}
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(operation.totalDepthMm<=0)errors.push('Bohrtiefe muss größer als 0 sein.');
  if(operation.stepDownMm<=0)errors.push(operation.method==='helical-mill'?'Helix-Zustellung pro Umdrehung muss größer als 0 sein.':'Zustellung muss größer als 0 sein.');
  if(operation.feedMmMin<=0||operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');

  if(operation.method==='helical-mill'){
    if(operation.tool.kind!=='end-mill')errors.push('Helixfräsen benötigt einen Schaftfräser aus der Werkzeugbibliothek.');
    for(const id of operation.curveIds){const c=curves[id];if(c?.kind==='circle'){
      const boreDiameter=c.radius*2;
      if(operation.tool.diameterMm>=boreDiameter)errors.push(`Bohrung ${id+1}: Werkzeug Ø ${f3(operation.tool.diameterMm)} mm muss kleiner als Bohrungs-Ø ${f3(boreDiameter)} mm sein.`);
      const pathRadius=c.radius-operation.tool.diameterMm/2;
      if(pathRadius<=0)errors.push(`Bohrung ${id+1}: Es bleibt kein positiver Helixbahnradius.`);
    }}
  }
  const passes=operation.stepDownMm>0?Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm)):0;
  return{ok:!errors.length,errors,warnings,passes,holeCount:operation.curveIds.length};
}

function emitAxialDrill(lines:string[],p:DrillPoint,index:number,count:number,operation:DrillOperation,passes:number){
  lines.push(`( Bohrung ${index+1}/${count} · DXF-Kreis ${p.id+1} )`,`G0 X${f3(p.x)} Y${f3(p.y)}`);
  for(let pass=1;pass<=passes;pass++){const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);if(pass<passes)lines.push('G0 Z0.000');}
  lines.push(`G0 Z${f3(operation.safeZMm)}`);
}

function emitHelicalMill(lines:string[],p:DrillPoint,index:number,count:number,operation:DrillOperation){
  const pathRadius=p.sourceRadiusMm-operation.tool.diameterMm/2;
  const rightX=p.x+pathRadius,leftX=p.x-pathRadius;
  lines.push(`( Helixbohrung ${index+1}/${count} · DXF-Kreis ${p.id+1} · Soll Ø${f3(p.sourceRadiusMm*2)} mm )`,`( Fräsermittelbahnradius ${f3(pathRadius)} mm · Helix-Zustellung ${f3(operation.stepDownMm)} mm/U )`,`G0 X${f3(rightX)} Y${f3(p.y)}`,`G1 Z0.000 F${Math.round(operation.plungeMmMin)}`);
  const helix=buildHelicalDescent({centerX:p.x,centerY:p.y,radiusMm:pathRadius,startDepthMm:0,targetDepthMm:operation.totalDepthMm,pitchMm:operation.stepDownMm,feedMmMin:operation.feedMmMin});
  if(!helix.ok)throw new Error(helix.error??'Helix konnte nicht erzeugt werden.');
  lines.push(...helix.lines);
  lines.push(`( Fertigumlauf auf Endtiefe · ${helix.turns} Helixumdrehung${helix.turns===1?'':'en'} )`,`G3 X${f3(leftX)} Y${f3(p.y)} I${f3(-pathRadius)} J0.000 F${Math.round(operation.feedMmMin)}`,`G3 X${f3(rightX)} Y${f3(p.y)} I${f3(pathRadius)} J0.000 F${Math.round(operation.feedMmMin)}`,`G0 Z${f3(operation.safeZMm)}`);
}

export function generateDrillGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation}):DrillGcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;const validation=validateDrillOperation(summary,operation),errors=[...validation.errors],warnings=[...validation.warnings];
  const fail=(extra:string[]=[]):DrillGcodeResult=>({ok:false,errors:[...errors,...extra],warnings,code:'',lineCount:0,holeCount:0,passesPerHole:validation.passes,points:[],method:operation.method});
  if(wcs.z!=='top')errors.push('WCS Unterseite ist für Bohren/Helixfräsen in 001V noch nicht freigegeben.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Materialgrenzen können nur eingeschränkt geprüft werden.');
  if(stockMode!=='none'&&operation.totalDepthMm>stock.thickness)warnings.push(`Bohrtiefe ${f3(operation.totalDepthMm)} mm überschreitet die Rohlingdicke ${f3(stock.thickness)} mm.`);
  if(errors.length)return fail();
  const t=placementTranslation(summary,stock,stockMode,placement,orientation);if(!t)return fail(['Bauteilgeometrie konnte nicht transformiert werden.']);const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const transform=(p:Point2):P2=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx-origin.x,y:q.y+t.dy-origin.y}};
  const curves=summary.planarGeometry?.curves??[];const raw:DrillPoint[]=[];
  for(const id of operation.curveIds){const c=curves[id];if(!c||c.kind!=='circle')return fail([`Geometrie ${id+1} ist nicht mehr als DXF-Kreis verfügbar.`]);const p=transform(c.center);raw.push({id,x:p.x,y:p.y,sourceRadiusMm:c.radius});}
  const points=orderNearest(raw,{x:0,y:0});const lines:string[]=[];
  if(operation.method==='helical-mill'){
    lines.push('( BeBlog CAM 001W )','( Operation: Bohren · Verfahren: Helixfräsen )','( Gemeinsame Helixprimitive: Bohren + Kreistasche )',`( Werkzeug: ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`,`( ${points.length} Bohrposition${points.length===1?'':'en'} · Tiefe ${f3(operation.totalDepthMm)} mm · Helix ${f3(operation.stepDownMm)} mm/U )`,'G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
    try{points.forEach((p,i)=>emitHelicalMill(lines,p,i,points.length,operation));}catch(error){return fail([String(error)]);}
  }else{
    lines.push('( BeBlog CAM 001W )','( Operation: Bohren · Verfahren: Axial bohren )','( Strategie: explizite G0/G1-Bohrbewegungen · keine Canned Cycles )',`( Werkzeug: ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`,`( ${points.length} Bohrposition${points.length===1?'':'en'} · Tiefe ${f3(operation.totalDepthMm)} mm · max. Zustellung ${f3(operation.stepDownMm)} mm )`,'G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
    points.forEach((p,i)=>emitAxialDrill(lines,p,i,points.length,operation,validation.passes));
  }
  lines.push('M5','M30');const code=lines.join('\n')+'\n';return{ok:true,errors:[],warnings,code,lineCount:lines.length,holeCount:points.length,passesPerHole:validation.passes,points,method:operation.method};
}
