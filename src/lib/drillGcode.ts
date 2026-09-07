import type { DrillOperation, ImportSummary, Point2, StockDefinition, StockMode, WorkCoordinateSystem, PartOrientation, PartPlacement } from './types';
import { buildHelicalDescent } from './helicalMotion';
import { resolvePlanarPartTransform } from './partTransform';
import { validateToolCompatibility } from './validationGrammar';

export type DrillPoint={id:number;x:number;y:number;sourceRadiusMm:number};
export type DrillGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;holeCount:number;passesPerHole:number;points:DrillPoint[];method:'drill'|'helical-mill'};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const DIAMETER_EPS_MM=0.01;
const dist=(a:Point2,b:Point2)=>Math.hypot(a.x-b.x,a.y-b.y);
function orderNearest(points:DrillPoint[],start:Point2){const remaining=[...points],out:DrillPoint[]=[];let current=start;while(remaining.length){let best=0,bestD=Infinity;for(let i=0;i<remaining.length;i++){const d=dist(current,remaining[i]);if(d<bestD){bestD=d;best=i}}const next=remaining.splice(best,1)[0];out.push(next);current=next;}return out;}

export function resolvedDxfDrillDepth(operation:DrillOperation,stock:StockDefinition,stockMode:StockMode){
  if((operation.depthMode??'manual')==='stock-bottom'){
    if(stockMode==='none')return{ok:false,depthMm:0,error:'Durchbohren benötigt einen definierten Rohling.'};
    const overcut=operation.overcutMm??0;
    if(overcut<0)return{ok:false,depthMm:0,error:'Bohr-Overcut darf nicht negativ sein.'};
    return{ok:true,depthMm:stock.thickness+overcut,error:null};
  }
  if(!(operation.totalDepthMm>0))return{ok:false,depthMm:0,error:'Bohrtiefe muss größer als 0 sein.'};
  return{ok:true,depthMm:operation.totalDepthMm,error:null};
}

export function validateDrillOperation(summary:ImportSummary,operation:DrillOperation){
  const errors:string[]=[],warnings:string[]=[];const curves=summary.planarGeometry?.curves??[];
  if(summary.kind!=='dxf')errors.push('Bohren und Helixfräsen sind aktuell nur aus DXF freigegeben.');
  if(!operation.curveIds.length)errors.push('Keine Bohrposition ausgewählt.');
  for(const id of operation.curveIds){const c=curves[id];if(!c||c.kind!=='circle')errors.push(`Geometrie ${id+1} ist kein nativer DXF-Kreis.`);}
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if((operation.depthMode??'manual')==='manual'&&operation.totalDepthMm<=0)errors.push('Bohrtiefe muss größer als 0 sein.');
  if((operation.overcutMm??0)<0)errors.push('Bohr-Overcut darf nicht negativ sein.');
  if(operation.stepDownMm<=0)errors.push(operation.method==='helical-mill'?'Helix-Zustellung pro Umdrehung muss größer als 0 sein.':'Zustellung muss größer als 0 sein.');
  if(operation.feedMmMin<=0||operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');

  const compatibility=validateToolCompatibility(operation);
  if(compatibility.level==='fail')errors.push(compatibility.detail);
  else if(compatibility.level==='warn')warnings.push(compatibility.detail);

  if(operation.method==='helical-mill'){
    for(const id of operation.curveIds){const c=curves[id];if(c?.kind==='circle'){
      const boreDiameter=c.radius*2;
      if(operation.tool.diameterMm>=boreDiameter)errors.push(`Bohrung ${id+1}: Werkzeug Ø ${f3(operation.tool.diameterMm)} mm muss kleiner als Bohrungs-Ø ${f3(boreDiameter)} mm sein.`);
      const pathRadius=c.radius-operation.tool.diameterMm/2;
      if(pathRadius<=0)errors.push(`Bohrung ${id+1}: Es bleibt kein positiver Helixbahnradius.`);
    }}
  }else{
    for(const id of operation.curveIds){const c=curves[id];if(c?.kind==='circle'){
      const boreDiameter=c.radius*2;
      if(Math.abs(operation.tool.diameterMm-boreDiameter)>DIAMETER_EPS_MM)errors.push(`Bohrung ${id+1}: Axiales Bohren benötigt Werkzeug-Ø ${f3(boreDiameter)} mm passend zum Soll-Ø; gewählt sind ${f3(operation.tool.diameterMm)} mm.`);
    }}
  }
  return{ok:!errors.length,errors,warnings,holeCount:operation.curveIds.length};
}

function emitAxialDrill(lines:string[],p:DrillPoint,index:number,count:number,operation:DrillOperation,targetDepthMm:number,passes:number){
  lines.push(`( Bohrung ${index+1}/${count} · DXF-Kreis ${p.id+1} )`,`G0 X${f3(p.x)} Y${f3(p.y)}`);
  for(let pass=1;pass<=passes;pass++){const depth=-Math.min(targetDepthMm,pass*operation.stepDownMm);lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);if(pass<passes)lines.push('G0 Z0.000');}
  lines.push(`G0 Z${f3(operation.safeZMm)}`);
}

function emitHelicalMill(lines:string[],p:DrillPoint,index:number,count:number,operation:DrillOperation,targetDepthMm:number){
  const pathRadius=p.sourceRadiusMm-operation.tool.diameterMm/2;
  const rightX=p.x+pathRadius,leftX=p.x-pathRadius;
  lines.push(`( Helixbohrung ${index+1}/${count} · DXF-Kreis ${p.id+1} · Soll Ø${f3(p.sourceRadiusMm*2)} mm )`,`( Fräsermittelbahnradius ${f3(pathRadius)} mm · Helix-Zustellung ${f3(operation.stepDownMm)} mm/U )`,`G0 X${f3(rightX)} Y${f3(p.y)}`,`G1 Z0.000 F${Math.round(operation.plungeMmMin)}`);
  const helix=buildHelicalDescent({centerX:p.x,centerY:p.y,radiusMm:pathRadius,startDepthMm:0,targetDepthMm,pitchMm:operation.stepDownMm,feedMmMin:operation.feedMmMin});
  if(!helix.ok)throw new Error(helix.error??'Helix konnte nicht erzeugt werden.');
  lines.push(...helix.lines);
  lines.push(`( Fertigumlauf auf Endtiefe · ${helix.turns} Helixumdrehung${helix.turns===1?'':'en'} )`,`G3 X${f3(leftX)} Y${f3(p.y)} I${f3(-pathRadius)} J0.000 F${Math.round(operation.feedMmMin)}`,`G3 X${f3(rightX)} Y${f3(p.y)} I${f3(pathRadius)} J0.000 F${Math.round(operation.feedMmMin)}`,`G0 Z${f3(operation.safeZMm)}`);
}

export function generateDrillGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation}):DrillGcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;const validation=validateDrillOperation(summary,operation),errors=[...validation.errors],warnings=[...validation.warnings];
  const depthState=resolvedDxfDrillDepth(operation,stock,stockMode),targetDepthMm=depthState.depthMm;
  if(!depthState.ok&&depthState.error)errors.push(depthState.error);
  const passes=operation.stepDownMm>0&&targetDepthMm>0?Math.max(1,Math.ceil(targetDepthMm/operation.stepDownMm)):0;
  const fail=(extra:string[]=[]):DrillGcodeResult=>({ok:false,errors:[...errors,...extra],warnings,code:'',lineCount:0,holeCount:0,passesPerHole:passes,points:[],method:operation.method});
  if(wcs.z!=='top')errors.push('WCS Unterseite ist für Bohren und Helixfräsen nicht freigegeben.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Materialgrenzen können nur eingeschränkt geprüft werden.');
  if((operation.depthMode??'manual')==='manual'&&stockMode!=='none'&&targetDepthMm>stock.thickness)warnings.push(`Bohrtiefe ${f3(targetDepthMm)} mm überschreitet die Rohlingdicke ${f3(stock.thickness)} mm.`);
  if((operation.depthMode??'manual')==='stock-bottom')warnings.push(`Durchbohren: Rohling ${f3(stock.thickness)} mm + ${f3(operation.overcutMm??0)} mm Overcut → End-Z ${f3(-targetDepthMm)} mm.`);
  if(errors.length)return fail();

  const transform=resolvePlanarPartTransform({summary,stock,stockMode,placement,orientation});
  if(!transform)return fail(['Bauteilgeometrie konnte nicht transformiert werden.']);
  const curves=summary.planarGeometry?.curves??[];const raw:DrillPoint[]=[];
  for(const id of operation.curveIds){
    const c=curves[id];
    if(!c||c.kind!=='circle')return fail([`Geometrie ${id+1} ist nicht mehr als DXF-Kreis verfügbar.`]);
    const p=transform.toWcs(c.center,wcs);
    raw.push({id,x:p.x,y:p.y,sourceRadiusMm:c.radius});
  }

  const points=orderNearest(raw,{x:0,y:0});const lines:string[]=[];
  if(operation.method==='helical-mill'){
    lines.push('( BeBlog CAM 004X )','( Operation: Bohren · Verfahren: Helixfräsen )','( Placement/Orientation: unified part transform )','( Gemeinsame Helixprimitive: Bohren + Kreistasche )',`( Werkzeug: ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`,`( ${points.length} Bohrposition${points.length===1?'':'en'} · Tiefe ${f3(targetDepthMm)} mm · Helix ${f3(operation.stepDownMm)} mm/U )`,'G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
    try{points.forEach((p,i)=>emitHelicalMill(lines,p,i,points.length,operation,targetDepthMm));}catch(error){return fail([String(error)]);}
  }else{
    lines.push('( BeBlog CAM 004X )','( Operation: Bohren · Verfahren: Axial bohren )','( Placement/Orientation: unified part transform )','( Strategie: explizite G0/G1-Bohrbewegungen · keine Canned Cycles )',`( Werkzeug: ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`,`( ${points.length} Bohrposition${points.length===1?'':'en'} · Tiefe ${f3(targetDepthMm)} mm · max. Zustellung ${f3(operation.stepDownMm)} mm )`,'G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
    points.forEach((p,i)=>emitAxialDrill(lines,p,i,points.length,operation,targetDepthMm,passes));
  }
  lines.push('M5','M30');const code=lines.join('\n')+'\n';return{ok:true,errors:[],warnings,code,lineCount:lines.length,holeCount:points.length,passesPerHole:passes,points,method:operation.method};
}
