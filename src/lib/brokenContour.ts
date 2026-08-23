import { polygonArea, type P2 } from './contourMath';
import { offsetOpenChain, type OpenOffsetValidation } from './openContour';
import type { ToolpathSide } from './types';

const eps=1e-8;
const same=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y)<=eps;

export type BrokenContourPath={
  runs:P2[][];
  sourceRuns:P2[][];
  segmentCount:number;
  activeSegmentCount:number;
  excludedSegmentCount:number;
  validation:OpenOffsetValidation;
};

function basePoints(input:P2[]):P2[]{
  if(input.length>1&&same(input[0],input[input.length-1]))return input.slice(0,-1);
  return [...input];
}

export function closedContourSegmentCount(points:P2[]):number{return basePoints(points).length;}

export function buildActiveClosedRuns(points:P2[],excludedIds:number[]):P2[][]{
  const base=basePoints(points),n=base.length;
  if(n<2)return[];
  const excluded=new Set(excludedIds.filter(i=>Number.isInteger(i)&&i>=0&&i<n));
  if(!excluded.size)return[[...base,base[0]]];
  if(excluded.size>=n)return[];
  const firstGap=[...excluded].sort((a,b)=>a-b)[0];
  const runs:P2[][]=[];let current:P2[]=[];
  for(let step=1;step<=n;step++){
    const i=(firstGap+step)%n,a=base[i],b=base[(i+1)%n];
    if(excluded.has(i)){if(current.length>1){runs.push(current);current=[];}continue;}
    if(!current.length)current=[a,b];else current.push(b);
  }
  if(current.length>1)runs.push(current);
  return runs;
}

function sideForOpenOffset(points:P2[],side:ToolpathSide):'left'|'right'|'on-line'{
  if(side==='on-line')return'on-line';
  const area=polygonArea(points),outward:'left'|'right'=area>=0?'right':'left',inward:'left'|'right'=outward==='right'?'left':'right';
  return side==='outside'?outward:inward;
}

export function buildBrokenContourPath(points:P2[],excludedIds:number[],radiusMm:number,side:ToolpathSide,toleranceMm=.003):BrokenContourPath{
  const base=basePoints(points),segmentCount=base.length,excluded=new Set(excludedIds.filter(i=>Number.isInteger(i)&&i>=0&&i<segmentCount));
  const sourceRuns=buildActiveClosedRuns(points,[...excluded]),openSide=sideForOpenOffset(base,side),runs:P2[][]=[];
  let maxDeviationMm=0,maxParallelError=0,selfIntersects=false,sideOk=true,measuredMinMm=Infinity,measuredMaxMm=-Infinity,totalSegments=0;
  for(const run of sourceRuns){
    const r=offsetOpenChain(run,radiusMm,openSide,toleranceMm);runs.push(r.points);const v=r.validation;
    maxDeviationMm=Math.max(maxDeviationMm,v.maxDeviationMm);maxParallelError=Math.max(maxParallelError,v.maxParallelError);selfIntersects=selfIntersects||v.selfIntersects;sideOk=sideOk&&v.sideOk;measuredMinMm=Math.min(measuredMinMm,v.measuredMinMm);measuredMaxMm=Math.max(measuredMaxMm,v.measuredMaxMm);totalSegments+=v.segmentCount;
  }
  const activeSegmentCount=segmentCount-excluded.size,expectedMm=side==='on-line'?0:Math.abs(radiusMm);
  const ok=segmentCount>=3&&excluded.size>0&&activeSegmentCount>0&&sourceRuns.length>0&&runs.every(r=>r.length>1)&&!selfIntersects&&sideOk&&maxDeviationMm<=toleranceMm;
  const validation:OpenOffsetValidation={ok,expectedMm,measuredMinMm:Number.isFinite(measuredMinMm)?measuredMinMm:NaN,measuredMaxMm:Number.isFinite(measuredMaxMm)?measuredMaxMm:NaN,maxDeviationMm:Number.isFinite(maxDeviationMm)?maxDeviationMm:Infinity,maxParallelError,segmentCount:totalSegments,sideOk,selfIntersects};
  return{runs,sourceRuns,segmentCount,activeSegmentCount,excludedSegmentCount:excluded.size,validation};
}
