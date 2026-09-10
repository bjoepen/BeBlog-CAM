import type { ToolpathPoint3 } from './canonicalToolpath';
import type { JobPreviewScene, JobPreviewSegment } from './jobPreviewScene';

export type JobPreviewSimulationStep={
  segment:JobPreviewSegment;
  startDistance:number;
  endDistance:number;
  length:number;
};

export type JobPreviewSimulationTimeline={
  steps:JobPreviewSimulationStep[];
  totalDistance:number;
};

export type JobPreviewSimulationFrame={
  completedSegmentCount:number;
  currentStep:JobPreviewSimulationStep|null;
  currentPoint:ToolpathPoint3|null;
  progress:number;
};

function distance3(a:ToolpathPoint3,b:ToolpathPoint3){
  return Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
}

function polylineLength(points:ToolpathPoint3[]){
  let length=0;
  for(let index=1;index<points.length;index+=1)length+=distance3(points[index-1],points[index]);
  return length;
}

function pointAtDistance(points:ToolpathPoint3[],distance:number):ToolpathPoint3|null{
  if(!points.length)return null;
  if(points.length===1)return points[0];
  let remaining=Math.max(0,distance);
  for(let index=1;index<points.length;index+=1){
    const start=points[index-1],end=points[index],length=distance3(start,end);
    if(length<=1e-9)continue;
    if(remaining<=length){
      const t=remaining/length;
      return{x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,z:start.z+(end.z-start.z)*t};
    }
    remaining-=length;
  }
  return points[points.length-1];
}

export function buildJobPreviewSimulationTimeline(scene:JobPreviewScene):JobPreviewSimulationTimeline{
  const steps:JobPreviewSimulationStep[]=[];
  let cursor=0;
  for(const segment of scene.segments){
    const length=polylineLength(segment.points);
    const startDistance=cursor,endDistance=cursor+length;
    steps.push({segment,startDistance,endDistance,length});
    cursor=endDistance;
  }
  return{steps,totalDistance:cursor};
}

export function sampleJobPreviewSimulation(timeline:JobPreviewSimulationTimeline,distance:number):JobPreviewSimulationFrame{
  if(!timeline.steps.length)return{completedSegmentCount:0,currentStep:null,currentPoint:null,progress:0};
  const clamped=Math.max(0,Math.min(timeline.totalDistance,distance));
  if(timeline.totalDistance<=1e-9){
    const last=timeline.steps[timeline.steps.length-1];
    return{completedSegmentCount:timeline.steps.length,currentStep:last,currentPoint:last.segment.points.at(-1)??null,progress:1};
  }
  let index=timeline.steps.findIndex(step=>clamped<step.endDistance-1e-9);
  if(index<0)index=timeline.steps.length-1;
  const step=timeline.steps[index];
  const local=Math.max(0,Math.min(step.length,clamped-step.startDistance));
  const completed=clamped>=timeline.totalDistance-1e-9?timeline.steps.length:index;
  return{
    completedSegmentCount:completed,
    currentStep:step,
    currentPoint:pointAtDistance(step.segment.points,local),
    progress:clamped/timeline.totalDistance
  };
}
