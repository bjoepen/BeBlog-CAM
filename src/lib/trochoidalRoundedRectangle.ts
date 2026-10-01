import type { P2, SemanticSegment, OffsetValidation } from './contourMath';

const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:P2,b:P2)=>a.x*b.y-a.y*b.x;
const sub=(a:P2,b:P2):P2=>({x:a.x-b.x,y:a.y-b.y});
const unit=(a:P2,b:P2):P2=>{const d=dist(a,b);return{x:(b.x-a.x)/d,y:(b.y-a.y)/d}};

export type RoundedRectangleOffset={segments:SemanticSegment[];validation:OffsetValidation};

/** E7B: exact convex four-LINE outside offset with tangent corner arcs. */
export function buildRoundedRectangleOutsideOffset(source:SemanticSegment[],offsetMm:number):RoundedRectangleOffset|null{
  if(!Array.isArray(source)||source.length!==4||!Number.isFinite(offsetMm)||offsetMm<=EPS
    ||source.some(s=>s.kind!=='line'))return null;
  const lines=source as Extract<SemanticSegment,{kind:'line'}>[];
  if(lines.some((s,i)=>dist(s.end,lines[(i+1)%4].start)>EPS||dist(s.start,s.end)<=EPS))return null;
  const edges=lines.map(s=>unit(s.start,s.end));
  // Rectangle only: adjacent edges perpendicular, opposite edges antiparallel.
  for(let i=0;i<4;i++)if(Math.abs(edges[i].x*edges[(i+1)%4].x+edges[i].y*edges[(i+1)%4].y)>EPS)return null;
  if(Math.abs(cross(edges[0],edges[2]))>EPS||edges[0].x*edges[2].x+edges[0].y*edges[2].y>-1+EPS
    ||Math.abs(cross(edges[1],edges[3]))>EPS||edges[1].x*edges[3].x+edges[1].y*edges[3].y>-1+EPS)return null;
  const area=lines.reduce((a,s)=>a+cross(s.start,s.end)/2,0);
  if(!Number.isFinite(area)||Math.abs(area)<=EPS)return null;
  const ccw=area>0;
  const normals=edges.map(e=>ccw?{x:e.y,y:-e.x}:{x:-e.y,y:e.x});
  const shiftedStart=lines.map((s,i)=>({x:s.start.x+normals[i].x*offsetMm,y:s.start.y+normals[i].y*offsetMm}));
  const shiftedEnd=lines.map((s,i)=>({x:s.end.x+normals[i].x*offsetMm,y:s.end.y+normals[i].y*offsetMm}));
  const segments:SemanticSegment[]=[];
  for(let i=0;i<4;i++){
    segments.push({kind:'line',start:shiftedStart[i],end:shiftedEnd[i]});
    const next=(i+1)%4,center=lines[i].end;
    if(dist(center,lines[next].start)>EPS)return null;
    segments.push({kind:'arc',start:shiftedEnd[i],end:shiftedStart[next],center:{...center},radius:offsetMm,ccw});
  }
  const validation:OffsetValidation={ok:true,expectedMm:offsetMm,measuredMinMm:offsetMm,measuredMaxMm:offsetMm,
    maxDeviationMm:0,maxParallelError:0,segmentCount:segments.length,sideOk:true};
  return{segments,validation};
}
