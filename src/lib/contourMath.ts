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
export type SemanticSegment =
  | { kind:'line'; start:P2; end:P2 }
  | { kind:'arc'; start:P2; end:P2; center:P2; radius:number; ccw:boolean };
export type SemanticContour = { id:number; segments:SemanticSegment[]; supported:boolean };
export type SemanticOffsetResult = { segments:SemanticSegment[]; validation:OffsetValidation };

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

function arcPoint(center:P2,radius:number,deg:number):P2{const a=deg*Math.PI/180;return{x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius}}
function reverseSegment(s:SemanticSegment):SemanticSegment{return s.kind==='line'?{kind:'line',start:s.end,end:s.start}:{...s,start:s.end,end:s.start,ccw:!s.ccw}}
function reverseSegments(segs:SemanticSegment[]):SemanticSegment[]{return[...segs].reverse().map(reverseSegment)}
function unitFrom(a:P2,b:P2){const l=dist(a,b)||1;return{x:(b.x-a.x)/l,y:(b.y-a.y)/l}}

function curveUnit(c:Curve2,transform:(p:P2)=>P2):SemanticSegment[]|null{
  if(c.kind==='line')return[{kind:'line',start:transform(c.start),end:transform(c.end)}];
  if(c.kind==='arc'){
    const center=transform(c.center),s=transform(arcPoint(c.center,c.radius,c.startAngleDeg)),e=transform(arcPoint(c.center,c.radius,c.endAngleDeg));
    return[{kind:'arc',start:s,end:e,center,radius:c.radius,ccw:true}];
  }
  if(c.kind==='polyline'){
    const pts=c.points.map(transform);if(pts.length<2)return null;const out:SemanticSegment[]=[];
    for(let i=1;i<pts.length;i++)out.push({kind:'line',start:pts[i-1],end:pts[i]});
    if(c.closed&&!same(pts[0],pts[pts.length-1]))out.push({kind:'line',start:pts[pts.length-1],end:pts[0]});
    return out;
  }
  return null;
}

export function buildSemanticContours(curves:Curve2[],transform:(p:P2)=>P2=(p)=>p):SemanticContour[]{
  const closed:SemanticContour[]=[];const open:{segments:SemanticSegment[];supported:boolean}[]=[];
  for(const c of curves){
    if(c.kind==='circle'){closed.push({id:closed.length,segments:[],supported:false});continue}
    const segs=curveUnit(c,transform);
    if(c.kind==='polyline'&&c.closed){closed.push({id:closed.length,segments:segs??[],supported:!!segs});continue}
    if(segs?.length)open.push({segments:segs,supported:true});
    else if(c.kind!=='unsupported')open.push({segments:[],supported:false});
  }
  const used=new Set<number>();
  for(let seed=0;seed<open.length;seed++){
    if(used.has(seed))continue;used.add(seed);let segs=[...open[seed].segments],supported=open[seed].supported;let progress=true;
    while(progress&&segs.length){progress=false;const a=segs[0].start,b=segs[segs.length-1].end;
      for(let i=0;i<open.length;i++){
        if(used.has(i)||!open[i].segments.length)continue;const s=open[i].segments,s0=s[0].start,s1=s[s.length-1].end;
        if(same(b,s0)){segs=[...segs,...s];supported&&=open[i].supported;used.add(i);progress=true;break}
        if(same(b,s1)){segs=[...segs,...reverseSegments(s)];supported&&=open[i].supported;used.add(i);progress=true;break}
        if(same(a,s1)){segs=[...s,...segs];supported&&=open[i].supported;used.add(i);progress=true;break}
        if(same(a,s0)){segs=[...reverseSegments(s),...segs];supported&&=open[i].supported;used.add(i);progress=true;break}
      }
    }
    if(segs.length&&same(segs[0].start,segs[segs.length-1].end))closed.push({id:closed.length,segments:segs,supported});
  }
  return closed;
}

function closest(points:P2[],target:P2):P2|null{return points.length?[...points].sort((a,b)=>dist(a,target)-dist(b,target))[0]:null}
function lineCircle(line:SemanticSegment&{kind:'line'},arc:SemanticSegment&{kind:'arc'}):P2[]{
  const d=unitFrom(line.start,line.end),fx=line.start.x-arc.center.x,fy=line.start.y-arc.center.y;
  const b=2*(fx*d.x+fy*d.y),c=fx*fx+fy*fy-arc.radius*arc.radius,disc=b*b-4*c;if(disc<0)return[];const q=Math.sqrt(Math.max(0,disc));
  return[(-b+q)/2,(-b-q)/2].map(t=>({x:line.start.x+d.x*t,y:line.start.y+d.y*t}));
}
function circleCircle(a:SemanticSegment&{kind:'arc'},b:SemanticSegment&{kind:'arc'}):P2[]{
  const dx=b.center.x-a.center.x,dy=b.center.y-a.center.y,d=Math.hypot(dx,dy);if(d<1e-9||d>a.radius+b.radius||d<Math.abs(a.radius-b.radius))return[];
  const x=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h2=a.radius*a.radius-x*x;if(h2<0)return[];const h=Math.sqrt(Math.max(0,h2)),ux=dx/d,uy=dy/d,px=a.center.x+x*ux,py=a.center.y+x*uy;
  return[{x:px-h*uy,y:py+h*ux},{x:px+h*uy,y:py-h*ux}];
}
function joinPoint(a:SemanticSegment,b:SemanticSegment,target:P2):P2|null{
  if(a.kind==='line'&&b.kind==='line')return lineIntersection(a.start,unitFrom(a.start,a.end),b.start,unitFrom(b.start,b.end));
  if(a.kind==='line'&&b.kind==='arc')return closest(lineCircle(a,b),target);
  if(a.kind==='arc'&&b.kind==='line')return closest(lineCircle(b,a),target);
  if(a.kind==='arc'&&b.kind==='arc')return closest(circleCircle(a,b),target);
  return null;
}
function setEnd(s:SemanticSegment,p:P2):SemanticSegment{return{...s,end:p} as SemanticSegment}
function setStart(s:SemanticSegment,p:P2):SemanticSegment{return{...s,start:p} as SemanticSegment}
function sampledSemantic(segs:SemanticSegment[]):P2[]{const pts:P2[]=[];for(const s of segs){if(!pts.length)pts.push(s.start);if(s.kind==='line')pts.push(s.end);else{const a0=Math.atan2(s.start.y-s.center.y,s.start.x-s.center.x),a1=Math.atan2(s.end.y-s.center.y,s.end.x-s.center.x);let delta=a1-a0;if(s.ccw){while(delta<=0)delta+=Math.PI*2}else{while(delta>=0)delta-=Math.PI*2}for(let i=1;i<=24;i++){const a=a0+delta*i/24;pts.push({x:s.center.x+Math.cos(a)*s.radius,y:s.center.y+Math.sin(a)*s.radius})}}}return pts}

export function offsetSemanticContour(contour:SemanticContour,correction:number,toleranceMm=.002):SemanticOffsetResult|null{
  if(!contour.supported||!contour.segments.length)return null;
  const sourcePts=sampledSemantic(contour.segments),area=polygonArea(sourcePts);if(Math.abs(area)<1e-9)return null;
  const outwardSign=area>0?-1:1,d=correction*outwardSign;let out:SemanticSegment[]=[];
  for(const s of contour.segments){
    if(s.kind==='line'){
      const u=unitFrom(s.start,s.end),n={x:-u.y*d,y:u.x*d};out.push({kind:'line',start:{x:s.start.x+n.x,y:s.start.y+n.y},end:{x:s.end.x+n.x,y:s.end.y+n.y}});
    }else{
      const r=s.radius-d*(s.ccw?1:-1);if(r<=0)return null;
      const us=unitFrom(s.center,s.start),ue=unitFrom(s.center,s.end);out.push({kind:'arc',center:{...s.center},radius:r,ccw:s.ccw,start:{x:s.center.x+us.x*r,y:s.center.y+us.y*r},end:{x:s.center.x+ue.x*r,y:s.center.y+ue.y*r}});
    }
  }
  for(let i=0;i<out.length;i++){
    const j=(i+1)%out.length,target=contour.segments[i].end,hit=joinPoint(out[i],out[j],target);if(!hit||dist(hit,target)>Math.max(25,Math.abs(correction)*10))return null;
    out[i]=setEnd(out[i],hit);out[j]=setStart(out[j],hit);
  }
  const expected=Math.abs(correction);let min=Infinity,max=-Infinity,maxDev=0,sideOk=true;
  for(let i=0;i<out.length;i++){
    const src=contour.segments[i],tool=out[i];let measured=0;
    if(src.kind==='line'&&tool.kind==='line'){
      const u=unitFrom(src.start,src.end),mid={x:(tool.start.x+tool.end.x)/2,y:(tool.start.y+tool.end.y)/2},signed=u.x*(mid.y-src.start.y)-u.y*(mid.x-src.start.x);measured=Math.abs(signed);
      if(Math.abs(correction)>1e-9&&Math.sign(signed)!==Math.sign(d))sideOk=false;
    }else if(src.kind==='arc'&&tool.kind==='arc'){
      measured=Math.abs(tool.radius-src.radius);const expectedRadius=src.radius-d*(src.ccw?1:-1);if(Math.abs(tool.radius-expectedRadius)>toleranceMm)sideOk=false;
    }else return null;
    min=Math.min(min,measured);max=Math.max(max,measured);maxDev=Math.max(maxDev,Math.abs(measured-expected));
  }
  const continuity=Math.max(...out.map((s,i)=>dist(s.end,out[(i+1)%out.length].start)));maxDev=Math.max(maxDev,continuity);
  const validation:OffsetValidation={ok:maxDev<=toleranceMm&&sideOk,expectedMm:expected,measuredMinMm:min,measuredMaxMm:max,maxDeviationMm:maxDev,maxParallelError:0,segmentCount:out.length,sideOk};
  return{segments:out,validation};
}

export function reverseSemanticPath(segs:SemanticSegment[]):SemanticSegment[]{return reverseSegments(segs)}
