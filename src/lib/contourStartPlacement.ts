import type { CanonicalToolpath, CanonicalToolpathRun, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import type { ContourOperation } from './types';

const EPS=1e-9;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const wrap01=(value:number)=>{if(!Number.isFinite(value))return 0;const wrapped=value%1;return wrapped<0?wrapped+1:wrapped;};
const same=(a:ToolpathPoint2,b:ToolpathPoint2)=>dist(a,b)<=1e-7;

function arcDelta(segment:Extract<CanonicalToolpathSegment,{kind:'arc'}>){
  let a0=Math.atan2(segment.start.y-segment.center.y,segment.start.x-segment.center.x);
  let a1=Math.atan2(segment.end.y-segment.center.y,segment.end.x-segment.center.x);
  let delta=a1-a0;
  if(segment.ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}
  return{a0,delta};
}

export function contourSegmentLength(segment:CanonicalToolpathSegment){
  if(segment.kind==='line')return dist(segment.start,segment.end);
  const radius=dist(segment.start,segment.center),{delta}=arcDelta(segment);
  return radius*Math.abs(delta);
}

function splitSegment(segment:CanonicalToolpathSegment,t:number):[CanonicalToolpathSegment,CanonicalToolpathSegment]{
  const u=Math.max(0,Math.min(1,t));
  if(segment.kind==='line'){
    const point={x:segment.start.x+(segment.end.x-segment.start.x)*u,y:segment.start.y+(segment.end.y-segment.start.y)*u};
    return[{kind:'line',start:{...segment.start},end:point},{kind:'line',start:point,end:{...segment.end}}];
  }
  const {a0,delta}=arcDelta(segment),radius=dist(segment.start,segment.center),angle=a0+delta*u;
  const point={x:segment.center.x+Math.cos(angle)*radius,y:segment.center.y+Math.sin(angle)*radius};
  return[
    {kind:'arc',start:{...segment.start},end:point,center:{...segment.center},ccw:segment.ccw},
    {kind:'arc',start:point,end:{...segment.end},center:{...segment.center},ccw:segment.ccw},
  ];
}

function segmentsForRun(run:CanonicalToolpathRun):CanonicalToolpathSegment[]{
  if(run.segments?.length)return run.segments.map(segment=>segment.kind==='line'?{kind:'line',start:{...segment.start},end:{...segment.end}}:{kind:'arc',start:{...segment.start},end:{...segment.end},center:{...segment.center},ccw:segment.ccw});
  return run.points.slice(1).map((end,index)=>({kind:'line' as const,start:{...run.points[index]},end:{...end}}));
}

function closedSegments(run:CanonicalToolpathRun){
  const segments=segmentsForRun(run);
  if(!segments.length)return null;
  if(!same(segments[0].start,segments.at(-1)!.end))return null;
  return segments;
}

export function resolveContourStartFraction(run:CanonicalToolpathRun,operation:ContourOperation){
  const segments=closedSegments(run);if(!segments)return{fraction:0,errors:['Konturstart benötigt eine geschlossene kanonische Kontur.'],warnings:[] as string[]};
  const lengths=segments.map(contourSegmentLength),perimeter=lengths.reduce((sum,length)=>sum+length,0);
  if(!(perimeter>EPS))return{fraction:0,errors:['Konturstart kann auf einer degenerierten Kontur nicht bestimmt werden.'],warnings:[] as string[]};
  if((operation.startMode??'auto')==='manual'){
    const raw=Number(operation.startFraction??0);
    if(!Number.isFinite(raw))return{fraction:0,errors:['Benutzerdefinierter Konturstart ist nicht endlich.'],warnings:[] as string[]};
    return{fraction:wrap01(raw),errors:[],warnings:[] as string[]};
  }
  let bestIndex=0,bestLength=-Infinity;
  for(let i=0;i<segments.length;i++){
    const preferred=segments[i].kind==='line';
    const score=lengths[i]*(preferred?2:1);
    if(score>bestLength){bestLength=score;bestIndex=i;}
  }
  const before=lengths.slice(0,bestIndex).reduce((sum,length)=>sum+length,0);
  return{fraction:wrap01((before+lengths[bestIndex]*.5)/perimeter),errors:[],warnings:[segments[bestIndex].kind==='line'?'Automatischer Konturstart liegt mittig auf einer bevorzugten langen Geraden.':'Keine geeignete Gerade gefunden; automatischer Konturstart liegt mittig auf dem längsten Kontursegment.']};
}

export function rotateClosedContourRun(run:CanonicalToolpathRun,fraction:number):CanonicalToolpathRun|null{
  const segments=closedSegments(run);if(!segments)return null;
  const lengths=segments.map(contourSegmentLength),perimeter=lengths.reduce((sum,length)=>sum+length,0);if(!(perimeter>EPS))return null;
  let target=wrap01(fraction)*perimeter,index=0;
  while(index<segments.length-1&&target>lengths[index]+EPS){target-=lengths[index];index++;}
  const length=lengths[index],t=length>EPS?Math.max(0,Math.min(1,target/length)):0;
  let rotated:CanonicalToolpathSegment[];
  if(t<=1e-8)rotated=[...segments.slice(index),...segments.slice(0,index)];
  else if(t>=1-1e-8){const next=(index+1)%segments.length;rotated=[...segments.slice(next),...segments.slice(0,next)];}
  else{
    const [before,after]=splitSegment(segments[index],t);
    rotated=[after,...segments.slice(index+1),...segments.slice(0,index),before];
  }
  const points:ToolpathPoint2[]=[{...rotated[0].start},...rotated.map(segment=>({...segment.end}))];
  return{...run,points,segments:rotated,entrySegments:undefined,exitSegments:undefined};
}

export function applyContourStartPlacement(toolpath:CanonicalToolpath,operation:ContourOperation):{toolpath:CanonicalToolpath;fraction:number;errors:string[];warnings:string[]}{
  if(toolpath.operationKind!=='contour'||operation.topology!=='closed'||!toolpath.runs.length)return{toolpath,fraction:0,errors:[],warnings:[]};
  if((operation.excludedSegmentIds??[]).length)return{toolpath,fraction:0,errors:[],warnings:['Aufgebrochene Kontur behält ihren fachlichen Anfang; freie Startpunktwahl gilt nur für vollständig geschlossene Konturen.']};
  const resolution=resolveContourStartFraction(toolpath.runs[0],operation);if(resolution.errors.length)return{toolpath,fraction:resolution.fraction,errors:resolution.errors,warnings:resolution.warnings};
  const runs:CanonicalToolpath['runs']=[];
  for(const run of toolpath.runs){
    const rotated=rotateClosedContourRun(run,resolution.fraction);
    if(!rotated)return{toolpath,fraction:resolution.fraction,errors:['Mindestens eine Kontur-Z-Ebene konnte nicht am gemeinsamen Startpunkt zyklisch neu angeordnet werden.'],warnings:resolution.warnings};
    runs.push(rotated);
  }
  return{toolpath:{...toolpath,runs,motions:undefined},fraction:resolution.fraction,errors:[],warnings:resolution.warnings};
}

export function pointAtContourFraction(points:ToolpathPoint2[],fraction:number):ToolpathPoint2|null{
  if(points.length<2)return null;
  const lengths=points.slice(1).map((point,index)=>dist(points[index],point)),total=lengths.reduce((sum,length)=>sum+length,0);if(!(total>EPS))return{...points[0]};
  let target=wrap01(fraction)*total;
  for(let i=0;i<lengths.length;i++){
    if(target<=lengths[i]||i===lengths.length-1){const t=lengths[i]>EPS?target/lengths[i]:0;return{x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}
    target-=lengths[i];
  }
  return{...points[0]};
}

export function nearestContourFraction(points:ToolpathPoint2[],pick:ToolpathPoint2){
  if(points.length<2)return 0;
  const lengths=points.slice(1).map((point,index)=>dist(points[index],point)),total=lengths.reduce((sum,length)=>sum+length,0);if(!(total>EPS))return 0;
  let bestDistance=Infinity,bestAlong=0,walked=0;
  for(let i=0;i<lengths.length;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2>EPS?Math.max(0,Math.min(1,((pick.x-a.x)*dx+(pick.y-a.y)*dy)/l2)):0;
    const q={x:a.x+dx*t,y:a.y+dy*t},d=dist(q,pick);
    if(d<bestDistance){bestDistance=d;bestAlong=walked+lengths[i]*t;}
    walked+=lengths[i];
  }
  return wrap01(bestAlong/total);
}
