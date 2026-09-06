import type { CanonicalToolpath, ToolpathPoint2 } from './canonicalToolpath';
import type { StockDefinition, WorkCoordinateSystem } from './types';

export type StockSimulationOperation={operationId:string;toolpath:CanonicalToolpath};
export type StockSimulationResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  cellSizeMm:number;
  columns:number;
  rows:number;
  initialVolumeMm3:number;
  remainingVolumeMm3:number;
  removedVolumeMm3:number;
  removedPercent:number;
  minSurfaceZ:number;
  maxSurfaceZ:number;
  touchedCells:number;
  operationCount:number;
  heights:Float32Array;
};

type Bounds={min:number;max:number};
const axisBounds=(length:number,origin:'min'|'center'|'max'):Bounds=>origin==='min'?{min:0,max:length}:origin==='max'?{min:-length,max:0}:{min:-length/2,max:length/2};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const distanceToSegment=(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2)=>{const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=1e-12)return Math.hypot(p.x-a.x,p.y-a.y);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));};

export function simulateStockHeightfield(args:{stock:StockDefinition;wcs:WorkCoordinateSystem;operations:StockSimulationOperation[];cellSizeMm?:number}):StockSimulationResult{
  const {stock,wcs,operations}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(!(stock.width>0&&stock.height>0&&stock.thickness>0))errors.push('Stock-Simulation benötigt einen Rohling mit positiven Abmessungen.');
  const requested=args.cellSizeMm??Math.max(.25,Math.min(2,Math.max(stock.width,stock.height)/220));
  if(!(requested>0&&Number.isFinite(requested)))errors.push('Stock-Simulation benötigt eine positive Zellgröße.');
  if(errors.length)return{ok:false,errors,warnings,cellSizeMm:requested,columns:0,rows:0,initialVolumeMm3:0,remainingVolumeMm3:0,removedVolumeMm3:0,removedPercent:0,minSurfaceZ:0,maxSurfaceZ:0,touchedCells:0,operationCount:operations.length,heights:new Float32Array()};
  const xb=axisBounds(stock.width,wcs.x==='left'?'min':wcs.x==='right'?'max':'center');
  const yb=axisBounds(stock.height,wcs.y==='front'?'min':wcs.y==='back'?'max':'center');
  const columns=Math.max(1,Math.ceil(stock.width/requested)),rows=Math.max(1,Math.ceil(stock.height/requested));
  const dx=stock.width/columns,dy=stock.height/rows,cellArea=dx*dy;
  const topZ=wcs.z==='top'?0:stock.thickness,bottomZ=wcs.z==='top'?-stock.thickness:0;
  const heights=new Float32Array(columns*rows);heights.fill(topZ);
  const touched=new Uint8Array(columns*rows);
  const cutDisk=(a:ToolpathPoint2,b:ToolpathPoint2,z:number,radius:number)=>{
    const target=clamp(z,Math.min(topZ,bottomZ),Math.max(topZ,bottomZ));
    const minX=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius-xb.min)/dx)),maxX=Math.min(columns-1,Math.floor((Math.max(a.x,b.x)+radius-xb.min)/dx));
    const minY=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius-yb.min)/dy)),maxY=Math.min(rows-1,Math.floor((Math.max(a.y,b.y)+radius-yb.min)/dy));
    for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){
      const p={x:xb.min+(ix+.5)*dx,y:yb.min+(iy+.5)*dy};if(distanceToSegment(p,a,b)>radius)continue;
      const idx=iy*columns+ix;const next=wcs.z==='top'?Math.min(heights[idx],target):Math.max(heights[idx],target);if(next!==heights[idx]){heights[idx]=next;touched[idx]=1;}
    }
  };
  for(const entry of operations){
    const radius=entry.toolpath.tool.diameterMm/2;if(!(radius>0))continue;
    for(const run of entry.toolpath.runs){
      if(!run.points.length)continue;
      if(run.points.length===1)cutDisk(run.points[0],run.points[0],run.z,radius);
      else for(let i=1;i<run.points.length;i++)cutDisk(run.points[i-1],run.points[i],run.z,radius);
    }
  }
  let remainingVolumeMm3=0,touchedCells=0,minSurfaceZ=Infinity,maxSurfaceZ=-Infinity;
  for(let i=0;i<heights.length;i++){
    const remainingHeight=wcs.z==='top'?heights[i]-bottomZ:topZ-heights[i];remainingVolumeMm3+=clamp(remainingHeight,0,stock.thickness)*cellArea;
    if(touched[i])touchedCells++;minSurfaceZ=Math.min(minSurfaceZ,heights[i]);maxSurfaceZ=Math.max(maxSurfaceZ,heights[i]);
  }
  const initialVolumeMm3=stock.width*stock.height*stock.thickness,removedVolumeMm3=Math.max(0,initialVolumeMm3-remainingVolumeMm3),removedPercent=initialVolumeMm3>0?removedVolumeMm3/initialVolumeMm3*100:0;
  if(!operations.length)warnings.push('Stock-Simulation enthält noch keine kanonische Bearbeitung.');
  return{ok:true,errors,warnings,cellSizeMm:Math.max(dx,dy),columns,rows,initialVolumeMm3,remainingVolumeMm3,removedVolumeMm3,removedPercent,minSurfaceZ:Number.isFinite(minSurfaceZ)?minSurfaceZ:topZ,maxSurfaceZ:Number.isFinite(maxSurfaceZ)?maxSurfaceZ:topZ,touchedCells,operationCount:operations.length,heights};
}
