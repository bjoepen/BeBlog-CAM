import type { P2,SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { buildRoundedRectangleOutsideOffset } from './trochoidalRoundedRectangle';

const EPS=1e-6,TAU=2*Math.PI;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const sub=(a:P2,b:P2):P2=>({x:a.x-b.x,y:a.y-b.y});
const dot=(a:P2,b:P2)=>a.x*b.x+a.y*b.y;
const cross=(a:P2,b:P2)=>a.x*b.y-a.y*b.x;
const positive=(a:number)=>((a%TAU)+TAU)%TAU;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));

function pointSegment(p:P2,a:P2,b:P2){
  const v=sub(b,a),vv=dot(v,v);if(vv<=EPS*EPS)return dist(p,a);
  const t=clamp(dot(sub(p,a),v)/vv);return dist(p,{x:a.x+v.x*t,y:a.y+v.y*t});
}
function orient(a:P2,b:P2,c:P2){return cross(sub(b,a),sub(c,a))}
function onSegment(p:P2,a:P2,b:P2){return Math.abs(orient(a,b,p))<=EPS&&dot(sub(p,a),sub(p,b))<=EPS}
function lineSegmentsIntersect(a:P2,b:P2,c:P2,d:P2){
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  return(o1*o2<0&&o3*o4<0)||onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
function segmentSegment(a:P2,b:P2,c:P2,d:P2){
  if(lineSegmentsIntersect(a,b,c,d))return 0;
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
function arcSweep(a:Extract<SemanticSegment,{kind:'arc'}>){
  const s=Math.atan2(a.start.y-a.center.y,a.start.x-a.center.x),e=Math.atan2(a.end.y-a.center.y,a.end.x-a.center.x);
  const full=dist(a.start,a.end)<=EPS;return{start:s,sweep:full?TAU:a.ccw?positive(e-s):positive(s-e),full};
}
function angleOnArc(a:Extract<SemanticSegment,{kind:'arc'}>,angle:number){
  const x=arcSweep(a);return x.full||(a.ccw?positive(angle-x.start):positive(x.start-angle))<=x.sweep+1e-10;
}
function pointArc(p:P2,a:Extract<SemanticSegment,{kind:'arc'}>){
  const angle=Math.atan2(p.y-a.center.y,p.x-a.center.x);
  return angleOnArc(a,angle)?Math.abs(dist(p,a.center)-a.radius):Math.min(dist(p,a.start),dist(p,a.end));
}
function arcSegment(a:Extract<SemanticSegment,{kind:'arc'}>,s:P2,e:P2){
  const v=sub(e,s),vv=dot(v,v);if(vv<=EPS*EPS)return pointArc(s,a);
  // Circle/segment intersections prove zero distance when they lie on the native arc.
  const f=sub(s,a.center),B=2*dot(f,v),C=dot(f,f)-a.radius*a.radius,D=B*B-4*vv*C;
  if(D>=-EPS){const q=Math.sqrt(Math.max(0,D));for(const t of[(-B-q)/(2*vv),(-B+q)/(2*vv)])
    if(t>=-EPS&&t<=1+EPS){const p={x:s.x+v.x*t,y:s.y+v.y*t};if(angleOnArc(a,Math.atan2(p.y-a.center.y,p.x-a.center.x)))return 0}}
  let best=Math.min(pointSegment(a.start,s,e),pointSegment(a.end,s,e),pointArc(s,a),pointArc(e,a));
  // Interior stationary point against the supporting line.
  const len=Math.sqrt(vv),n={x:-v.y/len,y:v.x/len};
  for(const sign of[-1,1]){
    const p={x:a.center.x+n.x*a.radius*sign,y:a.center.y+n.y*a.radius*sign};
    if(!angleOnArc(a,Math.atan2(p.y-a.center.y,p.x-a.center.x)))continue;
    const t=dot(sub(p,s),v)/vv;if(t>=0&&t<=1)best=Math.min(best,pointSegment(p,s,e));
  }
  return best;
}
function pointInsideRectangle(p:P2,lines:Extract<SemanticSegment,{kind:'line'}>[]){
  const signs=lines.map(l=>orient(l.start,l.end,p)).filter(v=>Math.abs(v)>EPS).map(Math.sign);
  return signs.length===0||signs.every(v=>v===signs[0]);
}
function segmentDistanceToRectangle(s:SemanticSegment,lines:Extract<SemanticSegment,{kind:'line'}>[]){
  if(pointInsideRectangle(s.start,lines)||pointInsideRectangle(s.end,lines))return 0;
  return Math.min(...lines.map(edge=>s.kind==='line'?segmentSegment(s.start,s.end,edge.start,edge.end):arcSegment(s,edge.start,edge.end)));
}
function sameSegment(a:SemanticSegment,b:SemanticSegment){
  if(a.kind!==b.kind||dist(a.start,b.start)>EPS||dist(a.end,b.end)>EPS)return false;
  return a.kind==='line'||(b.kind==='arc'&&dist(a.center,b.center)<=EPS&&Math.abs(a.radius-b.radius)<=EPS&&a.ccw===b.ccw);
}

export function rectanglePointClearanceMm(guide:TrochoidalContourGuide,p:P2):number|null{
  if(guide.side!=='outside'||guide.source.length!==4||guide.source.some(s=>s.kind!=='line'))return null;
  const lines=guide.source as Extract<SemanticSegment,{kind:'line'}>[];
  if(pointInsideRectangle(p,lines))return 0;
  return Math.min(...lines.map(l=>pointSegment(p,l.start,l.end)));
}

/** E7B exact native LINE/ARC clearance against a bound rounded rectangle outside offset. */
export function proveTrochoidalRectangleGuideBoundary(guide:TrochoidalContourGuide,path:SemanticSegment[],requireClosed=true){
  const fail=(error:string)=>({ok:false as const,minimumCenterClearanceMm:null,errors:[error]});
  if(guide?.side!=='outside'||!Number.isFinite(guide.signedOffsetMm)||guide.signedOffsetMm<=EPS
    ||guide.source.length!==4||guide.source.some(s=>s.kind!=='line'))return fail('Keine gültige native Rechteck-Außenführung.');
  const expected=buildRoundedRectangleOutsideOffset(guide.source,guide.signedOffsetMm);
  if(!expected||expected.segments.length!==guide.segments.length
    ||expected.segments.some((s,i)=>!sameSegment(s,guide.segments[i])))
    return fail('Rechteckführung ist nicht an den exakten tangentialen Außenoffset gebunden.');
  if(!Array.isArray(path)||!path.length)return fail('Kandidatenbahn fehlt.');
  const lines=guide.source as Extract<SemanticSegment,{kind:'line'}>[];
  let minimum=Infinity;
  for(let i=0;i<path.length;i++){
    if(i&&dist(path[i-1].end,path[i].start)>EPS)return fail(`Lücke vor Kandidatensegment ${i+1}.`);
    const d=segmentDistanceToRectangle(path[i],lines);if(!Number.isFinite(d))return fail('Rechteckabstand ist nicht endlich.');
    minimum=Math.min(minimum,d);
    if(d<guide.signedOffsetMm-EPS)return fail(`Kandidatensegment ${i+1} unterschreitet den geschützten Rechteckabstand.`);
  }
  if(requireClosed&&dist(path[path.length-1].end,path[0].start)>EPS)return fail('Geschlossene Rechteckführung benötigt eine geschlossene Kandidatenbahn.');
  return{ok:true as const,minimumCenterClearanceMm:minimum,errors:[]};
}
