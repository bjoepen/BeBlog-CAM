import type { P2 } from './contourMath';
import { buildStepManufacturingFeatureSource, type StepManufacturingEdgeSource, type StepManufacturingFaceSource } from './stepManufacturingFeatures';
import type { ImportSummary } from './types';

export type StepSideFaceContourSegment={edgeId:number;points:P2[]};
export type StepSideFaceContourTarget={
  targetKey:string;
  faceIds:number[];
  edgeIds:number[];
  segments:StepSideFaceContourSegment[];
  points:P2[];
  zMm:number;
  topology:'open';
};
export type StepSideFaceContourResult={target:StepSideFaceContourTarget|null;eligibleFaceIds:number[];errors:string[]};

const EPS=1e-5;
const same2=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y)<=1e-4;
const xyLength=(edge:StepManufacturingEdgeSource)=>Math.hypot(edge.end[0]-edge.start[0],edge.end[1]-edge.start[1]);

export function isStepContourSideFace(face:StepManufacturingFaceSource){
  if(face.kind==='plane')return Math.abs(face.normal[2])<=0.2;
  if(face.kind==='cylinder')return Math.abs(face.axisDirection[2])>=0.8;
  return false;
}

function sampleTopEdge(edge:StepManufacturingEdgeSource,z:number):P2[]|null{
  if(Math.abs(edge.start[2]-z)>1e-4||Math.abs(edge.end[2]-z)>1e-4||xyLength(edge)<=EPS)return null;
  const start={x:edge.start[0],y:edge.start[1]},end={x:edge.end[0],y:edge.end[1]};
  if(edge.kind==='line')return[start,end];
  if(edge.kind!=='circle'||!edge.center||!edge.radiusMm||!edge.axisDirection)return null;
  const center={x:edge.center[0],y:edge.center[1]},r=edge.radiusMm;
  if(edge.closed||same2(start,end))return null;
  const a0=Math.atan2(start.y-center.y,start.x-center.x),a1=Math.atan2(end.y-center.y,end.x-center.x);
  let ccw=edge.axisDirection[2]>=0;if(edge.orientation==='reversed')ccw=!ccw;
  let d=a1-a0;if(ccw){while(d<=0)d+=Math.PI*2}else{while(d>=0)d-=Math.PI*2}
  const steps=Math.max(8,Math.ceil(Math.abs(d)/(Math.PI/18)));
  return Array.from({length:steps+1},(_,i)=>{const a=a0+d*i/steps;return{x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r};});
}

function chainSegments(segments:StepSideFaceContourSegment[]){
  if(!segments.length)return null;
  const remaining=segments.map(segment=>({edgeId:segment.edgeId,points:[...segment.points]}));
  const out=[remaining.shift()!];
  while(remaining.length){
    const end=out.at(-1)!.points.at(-1)!;
    let index=-1,reverse=false;
    for(let i=0;i<remaining.length;i++){
      if(same2(end,remaining[i].points[0])){index=i;break;}
      if(same2(end,remaining[i].points.at(-1)!)){index=i;reverse=true;break;}
    }
    if(index<0){
      const start=out[0].points[0];
      for(let i=0;i<remaining.length;i++){
        if(same2(start,remaining[i].points.at(-1)!)){const next=remaining.splice(i,1)[0];out.unshift(next);index=i;break;}
        if(same2(start,remaining[i].points[0])){const next=remaining.splice(i,1)[0];out.unshift({edgeId:next.edgeId,points:[...next.points].reverse()});index=i;break;}
      }
      if(index<0)return null;
      continue;
    }
    const next=remaining.splice(index,1)[0];out.push({edgeId:next.edgeId,points:reverse?[...next.points].reverse():next.points});
  }
  const points=[...out[0].points];for(const segment of out.slice(1))points.push(...segment.points.slice(1));
  if(points.length<2||same2(points[0],points.at(-1)!))return null;
  return{segments:out,edgeIds:out.map(segment=>segment.edgeId),points};
}

export function buildStepSideFaceContour(summary:ImportSummary,selectedFaceIds:number[]):StepSideFaceContourResult{
  const sourceResult=buildStepManufacturingFeatureSource(summary);if(!sourceResult.ok)return{target:null,eligibleFaceIds:[],errors:[...sourceResult.errors]};
  const source=sourceResult.source;
  const eligibleFaceIds=source.faces.filter(isStepContourSideFace).map(face=>face.faceId);
  if(!selectedFaceIds.length)return{target:null,eligibleFaceIds,errors:[]};
  const selected=[...new Set(selectedFaceIds)].sort((a,b)=>a-b);
  if(selected.some(id=>!eligibleFaceIds.includes(id)))return{target:null,eligibleFaceIds,errors:['Die STEP-Auswahl enthält keine freigegebene Seitenfläche.']};
  const edgeIds=[...new Set(selected.flatMap(faceId=>(source.wiresByFace.get(faceId)??[]).flatMap(wire=>wire.edgeIds)))];
  const edges=edgeIds.map(id=>source.edges[id]).filter(Boolean);
  if(!edges.length)return{target:null,eligibleFaceIds,errors:['Die gewählten STEP-Seitenflächen besitzen keine BRep-Kanten.']};
  const z=Math.max(...edges.flatMap(edge=>[edge.start[2],edge.end[2]]));
  const segments=edges.flatMap(edge=>{const points=sampleTopEdge(edge,z);return points?[{edgeId:edge.edgeId,points}]:[];});
  const chain=chainSegments(segments);
  if(!chain)return{target:null,eligibleFaceIds,errors:['Die gewählten STEP-Seitenflächen ergeben noch keine einzelne zusammenhängende offene Profilkante.']};
  return{target:{targetKey:`step-side-faces:${selected.join(',')}`,faceIds:selected,edgeIds:chain.edgeIds,segments:chain.segments,points:chain.points,zMm:z,topology:'open'},eligibleFaceIds,errors:[]};
}

export function stepSideFaceContourAfterExclusions(target:StepSideFaceContourTarget,excludedEdgeIds:number[]):StepSideFaceContourTarget|null{
  if(!excludedEdgeIds.length)return target;
  const excluded=new Set(excludedEdgeIds),kept=target.segments.filter(segment=>!excluded.has(segment.edgeId));
  const chain=chainSegments(kept);if(!chain)return null;
  return{...target,targetKey:`${target.targetKey}:edges:${chain.edgeIds.join(',')}`,edgeIds:chain.edgeIds,segments:chain.segments,points:chain.points};
}
