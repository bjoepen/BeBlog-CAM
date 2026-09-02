import type { ToolpathSide } from './types';
import { polygonArea, type P2, type SemanticContour, type SemanticSegment } from './contourMath';
import { offsetOpenChain, type OpenOffsetValidation } from './openContour';

const eps=1e-8;
const distance=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const unit=(a:P2,b:P2)=>{const l=distance(a,b)||1;return{x:(b.x-a.x)/l,y:(b.y-a.y)/l}};

export type BrokenSemanticResult={
  sourceRuns:SemanticSegment[][];
  runs:SemanticSegment[][];
  segmentCount:number;
  activeSegmentCount:number;
  excludedSegmentCount:number;
  validation:OpenOffsetValidation;
};

export function sampleSemanticSegment(segment:SemanticSegment,steps=24):P2[]{
  if(segment.kind==='line')return[segment.start,segment.end];
  const a0=Math.atan2(segment.start.y-segment.center.y,segment.start.x-segment.center.x);
  const a1=Math.atan2(segment.end.y-segment.center.y,segment.end.x-segment.center.x);
  let delta=a1-a0;
  if(segment.ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}
  return Array.from({length:steps+1},(_,index)=>{
    const angle=a0+delta*index/steps;
    return{x:segment.center.x+Math.cos(angle)*segment.radius,y:segment.center.y+Math.sin(angle)*segment.radius};
  });
}

export function sampleSemanticRun(run:SemanticSegment[],steps=24):P2[]{
  const points:P2[]=[];
  for(const segment of run){
    const sampled=sampleSemanticSegment(segment,steps);
    points.push(...(points.length?sampled.slice(1):sampled));
  }
  return points;
}

function reverseSegment(segment:SemanticSegment):SemanticSegment{
  return segment.kind==='line'
    ?{kind:'line',start:segment.end,end:segment.start}
    :{...segment,start:segment.end,end:segment.start,ccw:!segment.ccw};
}
export function reverseSemanticRun(run:SemanticSegment[]):SemanticSegment[]{return[...run].reverse().map(reverseSegment)}

function lineIntersection(a:P2,ad:P2,b:P2,bd:P2):P2|null{
  const cross=ad.x*bd.y-ad.y*bd.x;
  if(Math.abs(cross)<eps)return null;
  const q={x:b.x-a.x,y:b.y-a.y};
  const t=(q.x*bd.y-q.y*bd.x)/cross;
  return{x:a.x+ad.x*t,y:a.y+ad.y*t};
}
function lineCircle(line:SemanticSegment&{kind:'line'},arc:SemanticSegment&{kind:'arc'}):P2[]{
  const d=unit(line.start,line.end),fx=line.start.x-arc.center.x,fy=line.start.y-arc.center.y;
  const b=2*(fx*d.x+fy*d.y),c=fx*fx+fy*fy-arc.radius*arc.radius,disc=b*b-4*c;
  if(disc<-eps)return[];
  const q=Math.sqrt(Math.max(0,disc));
  return[(-b+q)/2,(-b-q)/2].map(t=>({x:line.start.x+d.x*t,y:line.start.y+d.y*t}));
}
function circleCircle(a:SemanticSegment&{kind:'arc'},b:SemanticSegment&{kind:'arc'}):P2[]{
  const dx=b.center.x-a.center.x,dy=b.center.y-a.center.y,d=Math.hypot(dx,dy);
  if(d<eps||d>a.radius+b.radius+eps||d<Math.abs(a.radius-b.radius)-eps)return[];
  const x=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h2=a.radius*a.radius-x*x;
  if(h2<-eps)return[];
  const h=Math.sqrt(Math.max(0,h2)),ux=dx/d,uy=dy/d,px=a.center.x+x*ux,py=a.center.y+x*uy;
  return[{x:px-h*uy,y:py+h*ux},{x:px+h*uy,y:py-h*ux}];
}
function closest(points:P2[],target:P2):P2|null{return points.length?[...points].sort((a,b)=>distance(a,target)-distance(b,target))[0]:null}
function joinPoint(a:SemanticSegment,b:SemanticSegment,target:P2):P2|null{
  if(a.kind==='line'&&b.kind==='line')return lineIntersection(a.start,unit(a.start,a.end),b.start,unit(b.start,b.end));
  if(a.kind==='line'&&b.kind==='arc')return closest(lineCircle(a,b),target);
  if(a.kind==='arc'&&b.kind==='line')return closest(lineCircle(b,a),target);
  return closest(circleCircle(a as SemanticSegment&{kind:'arc'},b as SemanticSegment&{kind:'arc'}),target);
}
const setEnd=(segment:SemanticSegment,p:P2):SemanticSegment=>({...segment,end:p} as SemanticSegment);
const setStart=(segment:SemanticSegment,p:P2):SemanticSegment=>({...segment,start:p} as SemanticSegment);

function activeRuns(segments:SemanticSegment[],excludedIds:number[]):SemanticSegment[][]{
  const n=segments.length;if(!n)return[];
  const excluded=new Set(excludedIds.filter(id=>Number.isInteger(id)&&id>=0&&id<n));
  if(!excluded.size)return[[...segments]];
  if(excluded.size>=n)return[];
  const firstGap=[...excluded].sort((a,b)=>a-b)[0];
  const runs:SemanticSegment[][]=[];let current:SemanticSegment[]=[];
  for(let step=1;step<=n;step++){
    const index=(firstGap+step)%n;
    if(excluded.has(index)){if(current.length){runs.push(current);current=[]}continue}
    current.push(segments[index]);
  }
  if(current.length)runs.push(current);
  return runs;
}

function leftOffsetMm(contour:SemanticContour,radiusMm:number,side:ToolpathSide):number{
  if(side==='on-line')return 0;
  const points=sampleSemanticRun(contour.segments,16),area=polygonArea(points);
  const outwardLeft=area<0;
  if(side==='outside')return outwardLeft?radiusMm:-radiusMm;
  return outwardLeft?-radiusMm:radiusMm;
}
function openSide(contour:SemanticContour,side:ToolpathSide):'left'|'right'|'on-line'{
  const d=leftOffsetMm(contour,1,side);
  return d>0?'left':d<0?'right':'on-line';
}

function offsetSegment(segment:SemanticSegment,leftMm:number):SemanticSegment|null{
  if(Math.abs(leftMm)<eps)return segment.kind==='line'?{...segment}:{...segment,center:{...segment.center}};
  if(segment.kind==='line'){
    const u=unit(segment.start,segment.end),n={x:-u.y*leftMm,y:u.x*leftMm};
    return{kind:'line',start:{x:segment.start.x+n.x,y:segment.start.y+n.y},end:{x:segment.end.x+n.x,y:segment.end.y+n.y}};
  }
  const radius=segment.radius-leftMm*(segment.ccw?1:-1);
  if(radius<=eps)return null;
  const us=unit(segment.center,segment.start),ue=unit(segment.center,segment.end);
  return{kind:'arc',center:{...segment.center},radius,ccw:segment.ccw,start:{x:segment.center.x+us.x*radius,y:segment.center.y+us.y*radius},end:{x:segment.center.x+ue.x*radius,y:segment.center.y+ue.y*radius}};
}
function offsetRun(source:SemanticSegment[],leftMm:number):SemanticSegment[]|null{
  let out:SemanticSegment[]=[];
  for(const segment of source){const offset=offsetSegment(segment,leftMm);if(!offset)return null;out.push(offset)}
  for(let index=0;index+1<out.length;index++){
    const hit=joinPoint(out[index],out[index+1],source[index].end);
    if(!hit||distance(hit,source[index].end)>Math.max(25,Math.abs(leftMm)*10))return null;
    out[index]=setEnd(out[index],hit);out[index+1]=setStart(out[index+1],hit);
  }
  return out;
}

export function buildBrokenSemanticContour(contour:SemanticContour,excludedIds:number[],radiusMm:number,side:ToolpathSide,toleranceMm=.003):BrokenSemanticResult|null{
  if(!contour.supported||contour.segments.length<2)return null;
  const segmentCount=contour.segments.length,excluded=new Set(excludedIds.filter(id=>Number.isInteger(id)&&id>=0&&id<segmentCount));
  if(!excluded.size||excluded.size>=segmentCount)return null;
  const sourceRuns=activeRuns(contour.segments,[...excluded]);
  const leftMm=leftOffsetMm(contour,radiusMm,side),runs:SemanticSegment[][]=[];
  for(const source of sourceRuns){const offset=offsetRun(source,leftMm);if(!offset)return null;runs.push(offset)}

  let maxDeviationMm=0,maxParallelError=0,selfIntersects=false,sideOk=true,measuredMinMm=Infinity,measuredMaxMm=-Infinity,totalSegments=0;
  const validationSide=openSide(contour,side);
  for(const source of sourceRuns){
    const sampled=sampleSemanticRun(source,24),validation=offsetOpenChain(sampled,radiusMm,validationSide,toleranceMm).validation;
    maxDeviationMm=Math.max(maxDeviationMm,validation.maxDeviationMm);maxParallelError=Math.max(maxParallelError,validation.maxParallelError);
    selfIntersects=selfIntersects||validation.selfIntersects;sideOk=sideOk&&validation.sideOk;
    measuredMinMm=Math.min(measuredMinMm,validation.measuredMinMm);measuredMaxMm=Math.max(measuredMaxMm,validation.measuredMaxMm);totalSegments+=validation.segmentCount;
  }
  const activeSegmentCount=segmentCount-excluded.size,expectedMm=side==='on-line'?0:Math.abs(radiusMm);
  const ok=activeSegmentCount>0&&sourceRuns.length>0&&runs.every(run=>run.length>0)&&!selfIntersects&&sideOk&&maxDeviationMm<=toleranceMm;
  const validation:OpenOffsetValidation={ok,expectedMm,measuredMinMm:Number.isFinite(measuredMinMm)?measuredMinMm:NaN,measuredMaxMm:Number.isFinite(measuredMaxMm)?measuredMaxMm:NaN,maxDeviationMm:Number.isFinite(maxDeviationMm)?maxDeviationMm:Infinity,maxParallelError,segmentCount:totalSegments,sideOk,selfIntersects};
  return{sourceRuns,runs,segmentCount,activeSegmentCount,excludedSegmentCount:excluded.size,validation};
}
