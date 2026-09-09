import { polygonArea, type P2 } from './contourMath';
import { buildStepManufacturingFeatureSource, type StepManufacturingEdgeSource, type StepManufacturingWireSource } from './stepManufacturingFeatures';
import type { ImportSummary } from './types';

export type StepContourTargetTopology='closed'|'open';
export type StepContourTargetSegment={edgeId:number;points:P2[]};
export type StepContourTarget={
  targetKey:string;
  wireId:number;
  faceId:number;
  zMm:number;
  topology:StepContourTargetTopology;
  edgeIds:number[];
  segments:StepContourTargetSegment[];
  points:P2[];
  areaMm2:number;
};
export type StepContourTargetResult={targets:StepContourTarget[];errors:string[]};

const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=1e-4;

function sampleEdge(edge:StepManufacturingEdgeSource):P2[]|null{
  const start={x:edge.start[0],y:edge.start[1]},end={x:edge.end[0],y:edge.end[1]};
  if(edge.kind==='line')return[start,end];
  if(edge.kind!=='circle'||!edge.center||!edge.radiusMm||!edge.axisDirection)return null;
  const center={x:edge.center[0],y:edge.center[1]},r=edge.radiusMm;
  if(edge.closed||same(start,end))return Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};});
  const a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x);
  let ccw=edge.axisDirection[2]>=0;if(edge.orientation==='reversed')ccw=!ccw;
  let d=a1-a0;if(ccw){while(d<=0)d+=Math.PI*2}else{while(d>=0)d-=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(d)/(Math.PI/18)));
  return Array.from({length:steps+1},(_,i)=>{const a=a0+d*i/steps;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};});
}

function chainWire(wire:StepManufacturingWireSource,edges:StepManufacturingEdgeSource[]):StepContourTargetSegment[]|null{
  const remaining=wire.edgeIds.map(id=>({edgeId:id,points:sampleEdge(edges[id])})).filter((entry):entry is StepContourTargetSegment=>!!entry.points&&entry.points.length>=2);
  if(remaining.length!==wire.edgeIds.length||!remaining.length)return null;
  const first=remaining.shift()!;const out:StepContourTargetSegment[]=[{edgeId:first.edgeId,points:[...first.points]}];
  while(remaining.length){
    const end=out[out.length-1].points.at(-1)!;let index=-1,reverse=false;
    for(let i=0;i<remaining.length;i++){const p=remaining[i].points;if(same(end,p[0])){index=i;break}if(same(end,p[p.length-1])){index=i;reverse=true;break}}
    if(index<0)return null;
    const next=remaining.splice(index,1)[0];out.push({edgeId:next.edgeId,points:reverse?[...next.points].reverse():[...next.points]});
  }
  return out;
}

function flattenSegments(segments:StepContourTargetSegment[],closed:boolean):P2[]{
  if(!segments.length)return[];
  const points=[...segments[0].points];for(const segment of segments.slice(1))points.push(...segment.points.slice(1));
  if(closed&&!same(points[0],points[points.length-1]))points.push({...points[0]});
  return points;
}

export function buildStepContourTargets(summary:ImportSummary):StepContourTargetResult{
  const source=buildStepManufacturingFeatureSource(summary);if(!source.ok)return{targets:[],errors:[...source.errors]};
  const targets:StepContourTarget[]=[];
  for(const face of source.source.planarFaces){
    if(Math.abs(Math.abs(face.normal[2])-1)>1e-5)continue;
    for(const wire of source.source.wiresByFace.get(face.faceId)??[]){
      const segments=chainWire(wire,source.source.edges);if(!segments)continue;
      const points=flattenSegments(segments,wire.closed);if(points.length<2)continue;
      const areaMm2=wire.closed&&points.length>=4?Math.abs(polygonArea(points)):0;if(wire.closed&&areaMm2<=EPS)continue;
      targets.push({targetKey:`step-wire:${wire.wireId}`,wireId:wire.wireId,faceId:face.faceId,zMm:face.origin[2],topology:wire.closed?'closed':'open',edgeIds:segments.map(segment=>segment.edgeId),segments,points,areaMm2});
    }
  }
  targets.sort((a,b)=>b.zMm-a.zMm||b.areaMm2-a.areaMm2||a.wireId-b.wireId);
  return{targets,errors:[]};
}

/**
 * 004Z: STEP uses the same open-contour grammar as DXF. excludedSegmentIds
 * contains native STEP edgeIds for the selected target. Removing one or more
 * edges from a closed wire is valid only when the remainder is one connected chain.
 */
export function stepContourTargetAfterExclusions(target:StepContourTarget,excludedEdgeIds:number[]):StepContourTarget|null{
  if(!excludedEdgeIds.length)return target;
  const excluded=new Set(excludedEdgeIds);
  const chains:StepContourTargetSegment[][]=[];let chain:StepContourTargetSegment[]=[];
  for(const segment of target.segments){if(excluded.has(segment.edgeId)){if(chain.length)chains.push(chain);chain=[];continue}chain.push(segment)}
  if(chain.length)chains.push(chain);
  if(target.topology==='closed'&&chains.length>1){
    const first=chains[0],last=chains[chains.length-1],lastEnd=last.at(-1)!.points.at(-1)!,firstStart=first[0].points[0];
    if(same(lastEnd,firstStart)){chains[0]=[...last,...first];chains.pop()}
  }
  if(chains.length!==1||!chains[0].length)return null;
  const kept=chains[0],points=flattenSegments(kept,false);
  return{...target,targetKey:`${target.targetKey}:open:${kept.map(segment=>segment.edgeId).join(',')}`,topology:'open',edgeIds:kept.map(segment=>segment.edgeId),segments:kept,points,areaMm2:0};
}
