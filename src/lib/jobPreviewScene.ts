import type { CanonicalMachineMotion, ToolpathPoint3 } from './canonicalToolpath';
import type { JobPreflightResult } from './jobPreflight';

export type JobPreviewSegment={
  operationId:string;
  operationIndex:number;
  operationLabel:string;
  motionIndex:number;
  kind:CanonicalMachineMotion['kind'];
  points:ToolpathPoint3[];
};

export type JobPreviewBounds={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};

export type JobPreviewScene={
  segments:JobPreviewSegment[];
  bounds:JobPreviewBounds|null;
  operationCount:number;
  motionCount:number;
  rapidCount:number;
  cuttingCount:number;
};

function sampleMotion(motion:CanonicalMachineMotion):ToolpathPoint3[]{
  if(motion.kind!=='arc3')return[motion.start,motion.end];
  const radius=Math.hypot(motion.start.x-motion.center.x,motion.start.y-motion.center.y);
  if(!(radius>0))return[motion.start,motion.end];
  const startAngle=Math.atan2(motion.start.y-motion.center.y,motion.start.x-motion.center.x);
  let endAngle=Math.atan2(motion.end.y-motion.center.y,motion.end.x-motion.center.x);
  let delta=endAngle-startAngle;
  if(motion.ccw){while(delta<=0)delta+=Math.PI*2;}else{while(delta>=0)delta-=Math.PI*2;}
  const steps=Math.max(12,Math.ceil(Math.abs(delta)/(Math.PI/18)));
  return Array.from({length:steps+1},(_,index)=>{
    const t=index/steps,angle=startAngle+delta*t;
    return{
      x:motion.center.x+Math.cos(angle)*radius,
      y:motion.center.y+Math.sin(angle)*radius,
      z:motion.start.z+(motion.end.z-motion.start.z)*t
    };
  });
}

export function buildJobPreviewScene(result:JobPreflightResult):JobPreviewScene{
  const segments:JobPreviewSegment[]=[];
  const allPoints:ToolpathPoint3[]=[];
  let rapidCount=0,cuttingCount=0;

  for(const operation of result.operations){
    const motions=operation.toolpath?.motions??[];
    motions.forEach((motion,motionIndex)=>{
      const points=sampleMotion(motion);
      segments.push({
        operationId:operation.id,
        operationIndex:operation.index,
        operationLabel:operation.label,
        motionIndex,
        kind:motion.kind,
        points
      });
      allPoints.push(...points);
      if(motion.kind==='rapid3')rapidCount+=1;else cuttingCount+=1;
    });
  }

  const bounds=allPoints.length?{
    minX:Math.min(...allPoints.map(point=>point.x)),
    maxX:Math.max(...allPoints.map(point=>point.x)),
    minY:Math.min(...allPoints.map(point=>point.y)),
    maxY:Math.max(...allPoints.map(point=>point.y)),
    minZ:Math.min(...allPoints.map(point=>point.z)),
    maxZ:Math.max(...allPoints.map(point=>point.z))
  }:null;

  return{
    segments,
    bounds,
    operationCount:new Set(segments.map(segment=>segment.operationId)).size,
    motionCount:segments.length,
    rapidCount,
    cuttingCount
  };
}
