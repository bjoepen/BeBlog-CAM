import type { P2 } from './contourMath';

const EPS=1e-6;
const dist=(a:P2,b:P2)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a:P2,b:P2)=>dist(a,b)<=1e-4;

function lineIntersection(a:P2,ad:P2,b:P2,bd:P2):P2|null{
  const cross=ad.x*bd.y-ad.y*bd.x;
  if(Math.abs(cross)<1e-8)return null;
  const q={x:b.x-a.x,y:b.y-a.y},t=(q.x*bd.y-q.y*bd.x)/cross;
  return{x:a.x+ad.x*t,y:a.y+ad.y*t};
}

export type OpenContourSide='left'|'right'|'on-line';

/** Positive distance means left of traversal, negative means right. */
export function offsetOpenPolyline(input:P2[],distanceMm:number):P2[]{
  if(Math.abs(distanceMm)<1e-9)return input.map(p=>({...p}));
  const points=input.filter((p,i,a)=>i===0||!same(p,a[i-1]));
  if(points.length<2)return points;
  const dirs:P2[]=[],normals:P2[]=[];
  for(let i=1;i<points.length;i++){
    const dx=points[i].x-points[i-1].x,dy=points[i].y-points[i-1].y,l=Math.hypot(dx,dy);
    if(l<=EPS)continue;
    const d={x:dx/l,y:dy/l};
    dirs.push(d);
    normals.push({x:-d.y*distanceMm,y:d.x*distanceMm});
  }
  if(dirs.length!==points.length-1)return[];
  const out:P2[]=[{x:points[0].x+normals[0].x,y:points[0].y+normals[0].y}];
  for(let i=1;i<points.length-1;i++){
    const a={x:points[i].x+normals[i-1].x,y:points[i].y+normals[i-1].y};
    const b={x:points[i].x+normals[i].x,y:points[i].y+normals[i].y};
    const hit=lineIntersection(a,dirs[i-1],b,dirs[i]);
    if(hit&&dist(hit,points[i])<=Math.max(Math.abs(distanceMm)*8,20))out.push(hit);
    else out.push({x:points[i].x+(normals[i-1].x+normals[i].x)/2,y:points[i].y+(normals[i-1].y+normals[i].y)/2});
  }
  const last=points.at(-1)!,n=normals.at(-1)!;
  out.push({x:last.x+n.x,y:last.y+n.y});
  return out;
}

export function openContourCorrection(side:OpenContourSide,toolDiameterMm:number):number{
  const radius=Math.max(0,toolDiameterMm)/2;
  return side==='left'?radius:side==='right'?-radius:0;
}
