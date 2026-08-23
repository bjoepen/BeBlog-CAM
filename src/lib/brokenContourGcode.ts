import type { ContourOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { buildClosedChains, sampleCurve, type P2 } from './contourMath';
import { buildBrokenContourPath } from './brokenContour';
import type { GcodeResult } from './closedContourGcode';

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const rotate=(p:P2,deg:number):P2=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};

function placementTranslation(summary:ImportSummary,stock:StockDefinition,stockMode:StockMode,placement:PartPlacement,orientation:PartOrientation){
  const curves=summary.planarGeometry?.curves??[],all=curves.flatMap(c=>sampleCurve(c).map(p=>rotate(p,orientation.rotationZDeg)));if(!all.length)return null;
  const b=bounds(all),w=b.maxX-b.minX,h=b.maxY-b.minY;
  if(stockMode==='none')return{dx:-b.minX,dy:-b.minY,partBounds:{minX:0,maxX:w,minY:0,maxY:h}};
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,partBounds:{minX:tx+placement.offsetX,maxX:tx+w+placement.offsetX,minY:ty+placement.offsetY,maxY:ty+h+placement.offsetY}};
}
function wcsOrigin(stock:StockDefinition,stockMode:StockMode,wcs:WorkCoordinateSystem,partBounds:{minX:number;maxX:number;minY:number;maxY:number}){const b=stockMode==='none'?partBounds:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};return{x:wcs.x==='left'?b.minX:wcs.x==='right'?b.maxX:(b.minX+b.maxX)/2,y:wcs.y==='front'?b.minY:wcs.y==='back'?b.maxY:(b.minY+b.maxY)/2};}

export function generateBrokenContourGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation}):GcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;const errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='dxf')errors.push('Aufgebrochene Konturen sind zunächst nur aus DXF freigegeben.');
  if(operation.contourId===null)errors.push('Keine geschlossene Sollkontur gewählt.');
  if(!operation.excludedSegmentIds.length)errors.push('Keine Konturstrecke abgewählt. Die Kontur ist weiterhin geschlossen.');
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(operation.totalDepthMm<=0)errors.push('Gesamttiefe muss größer als 0 sein.');
  if(operation.stepDownMm<=0)errors.push('Zustellung muss größer als 0 sein.');
  if(operation.feedMmMin<=0||operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Schnittdaten sind unvollständig.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');
  if(wcs.z!=='top')errors.push('Aufgebrochene 2D-Konturen sind nur mit Z-Null auf der Rohlingoberseite freigegeben.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nicht vollständig prüfbar.');
  const fail=(validation?:ReturnType<typeof buildBrokenContourPath>['validation']):GcodeResult=>({ok:false,errors,warnings,code:'',lineCount:0,pointCount:0,passes:0,radiusMm:operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0,validation:validation?{ok:validation.ok,expectedMm:validation.expectedMm,measuredMinMm:validation.measuredMinMm,measuredMaxMm:validation.measuredMaxMm,maxDeviationMm:validation.maxDeviationMm,maxParallelError:validation.maxParallelError,segmentCount:validation.segmentCount,sideOk:validation.sideOk}:undefined});
  if(errors.length)return fail();
  const t=placementTranslation(summary,stock,stockMode,placement,orientation);if(!t){errors.push('Bauteilgeometrie konnte nicht transformiert werden.');return fail();}
  const move=(p:P2)=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx,y:q.y+t.dy}};
  const chains=buildClosedChains(summary.planarGeometry?.curves??[],move);const selected=operation.contourId===null?null:chains.find(c=>c.id===operation.contourId)??null;
  if(!selected){errors.push('Gewählte geschlossene Kontur wurde in der aktuellen Geometrie nicht gefunden.');return fail();}
  const broken=buildBrokenContourPath(selected.points,operation.excludedSegmentIds,operation.tool.diameterMm/2,operation.side,.003);
  if(!broken.activeSegmentCount){errors.push('Alle Konturstrecken sind abgewählt.');return fail(broken.validation);}
  if(!broken.validation.ok){errors.push(broken.validation.selfIntersects?'Die radiuskorrigierte Teilkontur schneidet sich selbst.':`Die aufgebrochene Werkzeugbahn hat die geometrische Prüfung nicht bestanden (max. Abweichung ${Number.isFinite(broken.validation.maxDeviationMm)?broken.validation.maxDeviationMm.toFixed(4):'—'} mm).`);return fail(broken.validation);}
  const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  let runs=broken.runs.map(run=>run.map(p=>({x:p.x-origin.x,y:p.y-origin.y})));
  if(operation.direction==='conventional')runs=runs.map(run=>[...run].reverse()).reverse();
  const passes=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm)),lines:string[]=[];
  const sideLabel=operation.side==='outside'?'außen':operation.side==='inside'?'innen':'auf Linie';
  lines.push('( BeBlog CAM 001Y )','( Operation: geschlossene Sollkontur mit abgewählten Strecken )',`( Aktiv ${broken.activeSegmentCount}/${broken.segmentCount} Konturstrecken · Werkzeugseite ${sideLabel} )`,'( Sicherheitsregel: Zwischen getrennten Teilkonturen und Z-Stufen wird immer auf Sicherheits-Z zurückgezogen )','G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
  let pointCount=0;
  for(let pass=1;pass<=passes;pass++){
    const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);lines.push(`( Zustellung ${pass}/${passes} · Z${f3(depth)} )`);
    for(let r=0;r<runs.length;r++){
      const run=runs[r];if(run.length<2)continue;pointCount+=run.length;
      lines.push(`( Teilkontur ${r+1}/${runs.length} )`,`G0 X${f3(run[0].x)} Y${f3(run[0].y)}`,`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);
      for(let i=1;i<run.length;i++)lines.push(`G1 X${f3(run[i].x)} Y${f3(run[i].y)} F${Math.round(operation.feedMmMin)}`);
      lines.push(`G0 Z${f3(operation.safeZMm)}`);
    }
  }
  lines.push('M5','M30');
  const v=broken.validation;
  return{ok:true,errors:[],warnings,code:lines.join('\n')+'\n',lineCount:lines.length,pointCount,passes,radiusMm:operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0,validation:{ok:v.ok,expectedMm:v.expectedMm,measuredMinMm:v.measuredMinMm,measuredMaxMm:v.measuredMaxMm,maxDeviationMm:v.maxDeviationMm,maxParallelError:v.maxParallelError,segmentCount:v.segmentCount,sideOk:v.sideOk}};
}
