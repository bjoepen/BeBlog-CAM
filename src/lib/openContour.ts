import type { Curve2 } from './types';
import { sampleCurve, type P2 } from './contourMath';

export type OpenContourSide='left'|'right'|'on-line';
export type OpenChain={id:number;points:P2[];closed:false};
export type OpenOffsetValidation={ok:boolean;expectedMm:number;measuredMinMm:number;measuredMaxMm:number;maxDeviationMm:number;maxParallelError:number;segmentCount:number;sideOk:boolean;selfIntersects:boolean};
export type OpenOffsetResult={points:P2[];validation:OpenOffsetValidation};

const tolerance=.08;
const eps=1e-9;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=tolerance;
const cross=(a:P2,b:P2,c:P2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

function dedupe(points:P2[]):P2[]{
  const out:P2[]=[];
  for(const p of points)if(!out.length||dist(out[out.length-1],p)>eps)out.push(p);
  return out;
}

export function buildOpenChains(curves:Curve2[],transform:(p:P2)=>P2=(p)=>p):OpenChain[]{
  const open:P2[][]=[];
  for(const c of curves){
    if(c.kind==='circle'||(c.kind==='polyline'&&c.closed)||c.kind==='unsupported')continue;
    const pts=dedupe(sampleCurve(c).map(transform));
    if(pts.length>=2)open.push(pts);
  }
  const used=new Set<number>(),chains:OpenChain[]=[];
  for(let seed=0;seed<open.length;seed++){
    if(used.has(seed))continue;
    used.add(seed);
    let pts=[...open[seed]],progress=true;
    while(progress){
      progress=false;
      for(let i=0;i<open.length;i++){
        if(used.has(i))continue;
        const s=open[i],a=pts[0],b=pts[pts.length-1],s0=s[0],s1=s[s.length-1];
        if(same(b,s0)){pts=[...pts,...s.slice(1)];used.add(i);progress=true;break}
        if(same(b,s1)){pts=[...pts,...[...s].reverse().slice(1)];used.add(i);progress=true;break}
        if(same(a,s1)){pts=[...s.slice(0,-1),...pts];used.add(i);progress=true;break}
        if(same(a,s0)){pts=[...[...s].reverse().slice(0,-1),...pts];used.add(i);progress=true;break}
      }
    }
    pts=dedupe(pts);
    if(pts.length>=2&&!same(pts[0],pts[pts.length-1]))chains.push({id:chains.length,points:pts,closed:false});
  }
  return chains;
}

function lineIntersection(a:P2,ad:P2,b:P2,bd:P2):P2|null{
  const d=ad.x*bd.y-ad.y*bd.x;
  if(Math.abs(d)<1e-10)return null;
  const q={x:b.x-a.x,y:b.y-a.y},t=(q.x*bd.y-q.y*bd.x)/d;
  return{x:a.x+ad.x*t,y:a.y+ad.y*t};
}

function segmentIntersection(a:P2,b:P2,c:P2,d:P2):boolean{
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  return ab1*ab2<0&&cd1*cd2<0;
}

function hasSelfIntersection(points:P2[]):boolean{
  for(let i=0;i<points.length-1;i++)for(let j=i+2;j<points.length-1;j++){
    if(i===0&&j===points.length-2)continue;
    if(segmentIntersection(points[i],points[i+1],points[j],points[j+1]))return true;
  }
  return false;
}

export function offsetOpenChain(sourceInput:P2[],distanceMm:number,side:OpenContourSide,toleranceMm=.002):OpenOffsetResult{
  const source=dedupe(sourceInput);
  const signed=side==='left'?Math.abs(distanceMm):side==='right'?-Math.abs(distanceMm):0;
  if(source.length<2){
    return{points:source,validation:{ok:false,expectedMm:Math.abs(distanceMm),measuredMinMm:NaN,measuredMaxMm:NaN,maxDeviationMm:Infinity,maxParallelError:Infinity,segmentCount:0,sideOk:false,selfIntersects:false}};
  }
  if(Math.abs(signed)<eps){
    const points=source.map(p=>({...p}));
    return{points,validation:{ok:true,expectedMm:0,measuredMinMm:0,measuredMaxMm:0,maxDeviationMm:0,maxParallelError:0,segmentCount:source.length-1,sideOk:true,selfIntersects:hasSelfIntersection(points)}};
  }
  const dirs=source.slice(0,-1).map((p,i)=>{const q=source[i+1],l=dist(p,q);return l>eps?{x:(q.x-p.x)/l,y:(q.y-p.y)/l}:{x:1,y:0}});
  const normals=dirs.map(u=>({x:-u.y*signed,y:u.x*signed}));
  const result:P2[]=[];
  result.push({x:source[0].x+normals[0].x,y:source[0].y+normals[0].y});
  for(let i=1;i<source.length-1;i++){
    const p=source[i],n0=normals[i-1],n1=normals[i],a={x:p.x+n0.x,y:p.y+n0.y},b={x:p.x+n1.x,y:p.y+n1.y};
    const hit=lineIntersection(a,dirs[i-1],b,dirs[i]);
    const limit=Math.max(Math.abs(signed)*8,20);
    if(hit&&dist(hit,p)<=limit)result.push(hit);
    else result.push({x:p.x+(n0.x+n1.x)/2,y:p.y+(n0.y+n1.y)/2});
  }
  const last=source.length-1,n=normals[normals.length-1];result.push({x:source[last].x+n.x,y:source[last].y+n.y});

  let min=Infinity,max=-Infinity,maxDev=0,maxParallel=0,sideOk=true,count=0;
  for(let i=0;i<source.length-1;i++){
    const a=source[i],b=source[i+1],ta=result[i],tb=result[i+1],sl=dist(a,b),tl=dist(ta,tb);if(sl<=eps||tl<=eps)continue;
    const su={x:(b.x-a.x)/sl,y:(b.y-a.y)/sl},tu={x:(tb.x-ta.x)/tl,y:(tb.y-ta.y)/tl},mid={x:(ta.x+tb.x)/2,y:(ta.y+tb.y)/2};
    const measuredSigned=su.x*(mid.y-a.y)-su.y*(mid.x-a.x),measured=Math.abs(measuredSigned),expected=Math.abs(signed);
    min=Math.min(min,measured);max=Math.max(max,measured);maxDev=Math.max(maxDev,Math.abs(measured-expected));maxParallel=Math.max(maxParallel,Math.abs(su.x*tu.y-su.y*tu.x));
    if(Math.sign(measuredSigned)!==Math.sign(signed))sideOk=false;count++;
  }
  const selfIntersects=hasSelfIntersection(result);
  return{points:result,validation:{ok:count>0&&maxDev<=toleranceMm&&maxParallel<=1e-6&&sideOk&&!selfIntersects,expectedMm:Math.abs(signed),measuredMinMm:min,measuredMaxMm:max,maxDeviationMm:maxDev,maxParallelError:maxParallel,segmentCount:count,sideOk,selfIntersects}};
}
