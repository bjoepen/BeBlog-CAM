import type { CanonicalToolpath, ToolpathPoint2 } from './canonicalToolpath';
import type { FacingOperation, StockDefinition, WorkCoordinateSystem } from './types';

export type FacingToolpathResult={
  toolpath:CanonicalToolpath;
  lanes:number;
  levels:number;
  stepoverMm:number;
};

function axisBounds(length:number,origin:'min'|'center'|'max'){
  if(origin==='min')return{min:0,max:length};
  if(origin==='max')return{min:-length,max:0};
  return{min:-length/2,max:length/2};
}

function buildLanes(min:number,max:number,requested:number){
  const span=max-min;
  if(span<=0)return[min];
  const count=Math.max(1,Math.ceil(span/requested));
  const step=span/count;
  return Array.from({length:count+1},(_,i)=>min+step*i);
}

export function buildFacingToolpath(args:{stock:StockDefinition;wcs:WorkCoordinateSystem;operation:FacingOperation}):FacingToolpathResult{
  const {stock,wcs,operation}=args;
  const requestedStepover=operation.tool.diameterMm*operation.stepoverPercent/100;
  const x=axisBounds(stock.width,wcs.x==='left'?'min':wcs.x==='right'?'max':'center');
  const y=axisBounds(stock.height,wcs.y==='front'?'min':wcs.y==='back'?'max':'center');
  const traverse=operation.direction==='x'?x:y;
  const cross=operation.direction==='x'?y:x;
  const lanes=buildLanes(cross.min,cross.max,requestedStepover);
  const stepoverMm=lanes.length>1?(cross.max-cross.min)/(lanes.length-1):0;
  const radius=operation.tool.diameterMm/2;
  const startTraverse=traverse.min-radius;
  const endTraverse=traverse.max+radius;
  const levels=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm));
  const runs=[] as CanonicalToolpath['runs'];

  for(let level=1;level<=levels;level++){
    const z=-Math.min(level*operation.stepDownMm,operation.totalDepthMm);
    const points:ToolpathPoint2[]=[];
    const first=operation.direction==='x'?{x:startTraverse,y:lanes[0]}:{x:lanes[0],y:startTraverse};
    points.push(first);
    lanes.forEach((crossValue,index)=>{
      const forward=index%2===0;
      const traverseValue=forward?endTraverse:startTraverse;
      const end=operation.direction==='x'?{x:traverseValue,y:crossValue}:{x:crossValue,y:traverseValue};
      points.push(end);
      const next=lanes[index+1];
      if(next!==undefined){
        const crossMove=operation.direction==='x'?{x:traverseValue,y:next}:{x:next,y:traverseValue};
        points.push(crossMove);
      }
    });
    runs.push({kind:'cut',z,points});
  }

  return{
    toolpath:{
      version:1,
      operationKind:'facing',
      strategy:'zigzag',
      tool:{diameterMm:operation.tool.diameterMm},
      stepoverPercent:operation.stepoverPercent,
      runs,
    },
    lanes:lanes.length,
    levels,
    stepoverMm,
  };
}
