import type { CanonicalToolpath, ToolpathPoint2 } from './canonicalToolpath';
import { simulateStockHeightfield, type StockSimulationOperation } from './stockSimulation';
import type { StockDefinition, WorkCoordinateSystem } from './types';

export type ToolAssemblyGeometry={
  cuttingLengthMm:number;
  stickoutMm:number;
  shankDiameterMm:number;
  holderDiameterMm:number;
};

export type ToolAssemblyCollisionResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  checkedSegments:number;
  collisionCells:number;
  minimumHolderClearanceMm:number|null;
};

type Bounds={min:number;max:number};
const axisBounds=(length:number,origin:'min'|'center'|'max'):Bounds=>origin==='min'?{min:0,max:length}:origin==='max'?{min:-length,max:0}:{min:-length/2,max:length/2};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const distanceToSegment=(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2)=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=1e-12)return Math.hypot(p.x-a.x,p.y-a.y);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));};

export function validateToolAssemblyAgainstRestStock(args:{
  stock:StockDefinition;
  wcs:WorkCoordinateSystem;
  previousOperations:StockSimulationOperation[];
  toolpath:CanonicalToolpath;
  assembly:ToolAssemblyGeometry;
  cellSizeMm?:number;
}):ToolAssemblyCollisionResult{
  const {stock,wcs,previousOperations,toolpath,assembly}=args,errors:string[]=[],warnings:string[]=[];
  const toolRadius=toolpath.tool.diameterMm/2,shankRadius=assembly.shankDiameterMm/2,holderRadius=assembly.holderDiameterMm/2;
  if(!(assembly.cuttingLengthMm>0&&assembly.stickoutMm>0&&assembly.shankDiameterMm>0&&assembly.holderDiameterMm>0))errors.push('Werkzeugbaugruppe benötigt positive Schneiden-, Auskrag- und Durchmesserwerte.');
  if(assembly.stickoutMm<assembly.cuttingLengthMm)errors.push('Auskraglänge darf nicht kleiner als die Schneidenlänge sein.');
  if(shankRadius+1e-9<toolRadius)errors.push('Schaftdurchmesser darf nicht kleiner als Werkzeugdurchmesser sein.');
  if(holderRadius+1e-9<shankRadius)errors.push('Halterdurchmesser darf nicht kleiner als Schaftdurchmesser sein.');
  if(wcs.z!=='top')errors.push('004Q Reststock-Kollisionsprüfung ist nur mit Z-Null auf Rohlingoberseite freigegeben.');
  if(errors.length)return{ok:false,errors,warnings,checkedSegments:0,collisionCells:0,minimumHolderClearanceMm:null};

  const stockState=simulateStockHeightfield({stock,wcs,operations:previousOperations,cellSizeMm:args.cellSizeMm});
  if(!stockState.ok)return{ok:false,errors:[...stockState.errors],warnings:[...stockState.warnings],checkedSegments:0,collisionCells:0,minimumHolderClearanceMm:null};
  const xb=axisBounds(stock.width,wcs.x==='left'?'min':wcs.x==='right'?'max':'center'),yb=axisBounds(stock.height,wcs.y==='front'?'min':wcs.y==='back'?'max':'center');
  const dx=stock.width/stockState.columns,dy=stock.height/stockState.rows;
  let checkedSegments=0,collisionCells=0,minimumHolderClearanceMm=Infinity;

  const checkSegment=(a:ToolpathPoint2,b:ToolpathPoint2,z:number)=>{
    checkedSegments++;
    const depth=Math.max(0,-z);
    if(depth>assembly.stickoutMm+1e-6){errors.push(`Werkzeugreichweite überschritten: ${depth.toFixed(3)} mm Tiefe bei ${assembly.stickoutMm.toFixed(3)} mm Auskraglänge.`);return;}
    if(depth>assembly.cuttingLengthMm+1e-6)warnings.push(`Schnitt liegt mit ${depth.toFixed(3)} mm tiefer als die definierte Schneidenlänge ${assembly.cuttingLengthMm.toFixed(3)} mm; Schaftkontakt ist möglich.`);
    const holderNoseZ=z+assembly.stickoutMm;
    if(holderNoseZ>=0)return;
    const minX=Math.max(0,Math.floor((Math.min(a.x,b.x)-holderRadius-xb.min)/dx)),maxX=Math.min(stockState.columns-1,Math.floor((Math.max(a.x,b.x)+holderRadius-xb.min)/dx));
    const minY=Math.max(0,Math.floor((Math.min(a.y,b.y)-holderRadius-yb.min)/dy)),maxY=Math.min(stockState.rows-1,Math.floor((Math.max(a.y,b.y)+holderRadius-yb.min)/dy));
    for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){
      const p={x:xb.min+(ix+.5)*dx,y:yb.min+(iy+.5)*dy},distance=distanceToSegment(p,a,b);
      if(distance<=toolRadius+1e-9||distance>holderRadius)continue;
      const surfaceZ=stockState.heights[iy*stockState.columns+ix],clearance=holderNoseZ-surfaceZ;
      minimumHolderClearanceMm=Math.min(minimumHolderClearanceMm,clearance);
      if(surfaceZ>holderNoseZ+1e-6)collisionCells++;
    }
  };

  for(const run of toolpath.runs){if(!run.points.length)continue;if(run.points.length===1)checkSegment(run.points[0],run.points[0],run.z);else for(let i=1;i<run.points.length;i++)checkSegment(run.points[i-1],run.points[i],run.z);}
  if(collisionCells>0)errors.push(`Halter kollidiert im 2.5D-Reststockmodell mit ${collisionCells} Rasterzelle${collisionCells===1?'':'n'}.`);
  if(!checkedSegments)warnings.push('Werkzeugbaugruppenprüfung enthält keine schneidenden Segmente.');
  return{ok:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],checkedSegments,collisionCells,minimumHolderClearanceMm:Number.isFinite(minimumHolderClearanceMm)?minimumHolderClearanceMm:null};
}
