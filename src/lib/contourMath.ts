import type { Curve2, Point2 } from './types';

export type P2 = { x:number; y:number };
export type Chain = { id:number; points:P2[]; closed:boolean };
export type OffsetValidation = {
  ok: boolean;
  expectedMm: number;
  measuredMinMm: number;
  measuredMaxMm: number;
  maxDeviationMm: number;
  maxParallelError: number;
  segmentCount: number;
  sideOk: boolean;
};

const tolerance=.08;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=tolerance;

export function sampleCurve(c:Curve2):Point2[]{
  if(c.kind==='line')return[c.start,c.end];
  if(c.kind==='polyline')return c.points;
  if(c.kind==='circle')return Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return{x:c.center.x+Math.cos(a)*c.radius,y:c.center.y+Math.sin(a)*c.radius}});
  if(c.kind==='arc'){
    let a=c.startAngleDeg,b=c.endAngleDeg;while(b<a)b+=360;
    return Array.from({length:49},(_,i)=>{const r=(a+(b-a)*i/48)*Math.PI/180;return{x:c.center.x+Math.cos(r)*c.radius,y:c.center.y+Math.sin(r)*c.radius}})
  }
  return[];
}

export function buildClosedChains(curves:Curve2[], transform:(p:P2)=>P2=(p)=>p):Chain[]{
  const closed:Chain[]=[]; const open:P2[][]=[];
  for(const c of curves){
    let pts=sampleCurve(c).map(transform); if(pts.length<2)continue;
    if(c.kind==='circle'||(c.kind==='polyline'&&c.closed)){
      if(!same(pts[0],pts[pts.length-1]))pts=[...pts,pts[0]];
      closed.push({id:closed.length,points:pts,closed:true});
    }else open.push(pts);
  }
  const used=new Set<number>();
  for(let seed=0;seed<open.length;seed++){
    if(used.has(seed))continue; used.add(seed); let pts=[...open[seed]]; let progress=true;
    while(progress){progress=false;
      for(let i=0;i<open.length;i++){
        if(used.has(i))continue; const s=open[i],a=pts[0],b=pts[pts.length-1],s0=s[0],s1=s[s.length-1];
        if(same(b,s0)){pts=[...pts,...s.slice(1)];used.add(i);progress=true;break}
        if(same(b,s1)){pts=[...pts,...[...s].reverse().slice(1)];used.add(i);progress=true;break}
        if(same(a,s1)){pts=[...s.slice(0,-1),...pts];used.add(i);progress=true;break}
        if(same(a,s0)){pts=[...[...s].reverse().slice(0,-1),...pts];used.add(i);progress=true;break}
      }
    }
    const isClosed=pts.length>2&&same(pts[0],pts[pts.length-1]);
    if(isClosed){pts[pts.length-1]=pts[0];closed.push({id:closed.length,points:pts,closed:true})}
  }
  return closed;
}

function lineIntersection(a:P2,ad:P2,b:P2,bd:P2):P2|null{
  const cross=ad.x*bd.y-ad.y*bd.x;if(Math.abs(cross)<1e-8)return null;
  const q={x:b.x-a.x,y:b.y-a.y},t=(q.x*bd.y-q.y*bd.x)/cross;return{x:a.x+ad.x*t,y:a.y+ad.y*t};
}

export function polygonArea(input:P2[]):number{
  let pts=[...input];if(pts.length>1&&same(pts[0],pts[pts.length-1]))pts=pts.slice(0,-1);
  let area=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];area+=p.x*q.y-q.x*p.y}
  return area/2;
}

export function offsetPolygon(input:P2[],distance:number):P2[]{
  if(Math.abs(distance)<1e-9)return input.map(p=>({...p}));
  let pts=[...input];if(same(pts[0],pts[pts.length-1]))pts=pts.slice(0,-1);if(pts.length<3)return input.map(p=>({...p}));
  const area=polygonArea(pts);const outwardSign=area>0?-1:1;const d=distance*outwardSign;const result:P2[]=[];
  for(let i=0;i<pts.length;i++){
    const prev=pts[(i-1+pts.length)%pts.length],cur=pts[i],next=pts[(i+1)%pts.length];
    const e1={x:cur.x-prev.x,y:cur.y-prev.y},e2={x:next.x-cur.x,y:next.y-cur.y},l1=Math.hypot(e1.x,e1.y)||1,l2=Math.hypot(e2.x,e2.y)||1;
    const u1={x:e1.x/l1,y:e1.y/l1},u2={x:e2.x/l2,y:e2.y/l2},n1={x:-u1.y*d,y:u1.x*d},n2={x:-u2.y*d,y:u2.x*d};
    const a={x:cur.x+n1.x,y:cur.y+n1.y},b={x:cur.x+n2.x,y:cur.y+n2.y},hit=lineIntersection(a,u1,b,u2);
    if(hit&&dist(hit,cur)<=Math.max(Math.abs(distance)*8,20))result.push(hit);else result.push({x:cur.x+(n1.x+n2.x)/2,y:cur.y+(n1.y+n2.y)/2});
  }
  return[...result,result[0]];
}

export function validateOffsetSegments(sourceInput:P2[], toolInput:P2[], signedDistanceMm:number, toleranceMm=.002):OffsetValidation{
  let source=[...sourceInput],tool=[...toolInput];
  if(source.length>1&&same(source[0],source[source.length-1]))source=source.slice(0,-1);
  if(tool.length>1&&same(tool[0],tool[tool.length-1]))tool=tool.slice(0,-1);
  if(source.length!==tool.length||source.length<3){
    return{ok:false,expectedMm:Math.abs(signedDistanceMm),measuredMinMm:NaN,measuredMaxMm:NaN,maxDeviationMm:Infinity,maxParallelError:Infinity,segmentCount:0,sideOk:false};
  }
  const area=polygonArea(source);const outwardSign=area>0?-1:1;const expectedSigned=signedDistanceMm*outwardSign;
  let min=Infinity,max=-Infinity,maxDev=0,maxParallel=0,sideOk=true,count=0;
  for(let i=0;i<source.length;i++){
    const a=source[i],b=source[(i+1)%source.length],ta=tool[i],tb=tool[(i+1)%tool.length];
    const sx=b.x-a.x,sy=b.y-a.y,sl=Math.hypot(sx,sy);if(sl<1e-8)continue;
    const tx=tb.x-ta.x,ty=tb.y-ta.y,tl=Math.hypot(tx,ty);if(tl<1e-8)continue;
    const su={x:sx/sl,y:sy/sl},tu={x:tx/tl,y:ty/tl};
    const mid={x:(ta.x+tb.x)/2,y:(ta.y+tb.y)/2};
    const signed=su.x*(mid.y-a.y)-su.y*(mid.x-a.x);
    const measured=Math.abs(signed);const expected=Math.abs(signedDistanceMm);
    min=Math.min(min,measured);max=Math.max(max,measured);maxDev=Math.max(maxDev,Math.abs(measured-expected));
    maxParallel=Math.max(maxParallel,Math.abs(su.x*tu.y-su.y*tu.x));
    if(Math.abs(expectedSigned)>1e-9&&Math.sign(signed)!==Math.sign(expectedSigned))sideOk=false;
    count++;
  }
  if(Math.abs(signedDistanceMm)<1e-9){sideOk=true;}
  const ok=count>0&&maxDev<=toleranceMm&&maxParallel<=1e-6&&sideOk;
  return{ok,expectedMm:Math.abs(signedDistanceMm),measuredMinMm:min,measuredMaxMm:max,maxDeviationMm:maxDev,maxParallelError:maxParallel,segmentCount:count,sideOk};
}
