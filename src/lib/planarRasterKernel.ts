import type { ToolpathPoint2 } from './canonicalToolpath';

export type PlanarRasterLoop={points:ToolpathPoint2[]};
export type PlanarRasterChain={points:ToolpathPoint2[]};

const EPS=1e-6;

function pointInEvenOdd(loops:PlanarRasterLoop[],p:ToolpathPoint2){
  let inside=false;
  for(const loop of loops){
    const poly=loop.points;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      const hit=((a.y>p.y)!==(b.y>p.y))&&
        p.x<((b.x-a.x)*(p.y-a.y))/(b.y-a.y||Number.EPSILON)+a.x;
      if(hit)inside=!inside;
    }
  }
  return inside;
}

function distanceToSegment(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2<=EPS)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function clearanceToBoundary(loops:PlanarRasterLoop[],p:ToolpathPoint2){
  let best=Infinity;
  for(const loop of loops){
    const points=loop.points;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      best=Math.min(best,distanceToSegment(p,a,b));
    }
  }
  return best;
}

function safeAt(loops:PlanarRasterLoop[],p:ToolpathPoint2,radius:number){
  return pointInEvenOdd(loops,p)&&clearanceToBoundary(loops,p)>=radius-EPS;
}

export function isPlanarRasterPointSafe(loops:PlanarRasterLoop[],point:ToolpathPoint2,toolDiameterMm:number){
  if(!(toolDiameterMm>0)||!loops.length)return false;
  return safeAt(loops,point,toolDiameterMm/2);
}

function safeConnector(
  loops:PlanarRasterLoop[],
  a:ToolpathPoint2,
  b:ToolpathPoint2,
  radius:number,
  sampleStep:number,
){
  const distance=Math.hypot(b.x-a.x,b.y-a.y);
  if(distance<=EPS)return safeAt(loops,a,radius);
  const steps=Math.max(1,Math.ceil(distance/Math.max(.1,sampleStep)));
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    if(!safeAt(loops,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},radius))return false;
  }
  return true;
}

function bounds(loops:PlanarRasterLoop[]){
  const pts=loops.flatMap(loop=>loop.points);
  if(!pts.length)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}

/**
 * Generate cutter-center-safe raster chains inside an arbitrary even/odd planar
 * region. This kernel knows nothing about STEP, stock or CAM operations.
 */
export function buildPlanarRasterChains(
  loops:PlanarRasterLoop[],
  toolDiameterMm:number,
  stepoverPercent:number,
):PlanarRasterChain[]{
  if(!(toolDiameterMm>0)||!(stepoverPercent>0&&stepoverPercent<=100)||!loops.length)return[];
  const b=bounds(loops);if(!b)return[];

  const radius=toolDiameterMm/2;
  const stepover=Math.max(.05,toolDiameterMm*stepoverPercent/100);
  const sampleStep=Math.max(.15,Math.min(.75,toolDiameterMm/8));

  const rasterSegments:PlanarRasterChain[]=[];
  let row=0;
  for(let y=b.minY+radius;y<=b.maxY-radius+EPS;y+=stepover,row++){
    const lineRuns:{a:number;b:number}[]=[];
    let start:number|null=null,last:number|null=null;

    for(let x=b.minX+radius;x<=b.maxX-radius+EPS;x+=sampleStep){
      if(safeAt(loops,{x,y},radius)){
        if(start===null)start=x;
        last=x;
      }else if(start!==null&&last!==null){
        if(last-start>EPS)lineRuns.push({a:start,b:last});
        start=last=null;
      }
    }
    if(start!==null&&last!==null&&last-start>EPS)lineRuns.push({a:start,b:last});

    const ordered=row%2===0?lineRuns:[...lineRuns].reverse();
    for(const segment of ordered){
      rasterSegments.push({
        points:row%2===0
          ?[{x:segment.a,y},{x:segment.b,y}]
          :[{x:segment.b,y},{x:segment.a,y}],
      });
    }
  }

  const linked:PlanarRasterChain[]=[];
  let current:ToolpathPoint2[]=[];
  for(const segment of rasterSegments){
    if(!current.length){
      current=[...segment.points];
      continue;
    }
    const from=current[current.length-1],to=segment.points[0];
    if(safeConnector(loops,from,to,radius,sampleStep)){
      if(Math.hypot(to.x-from.x,to.y-from.y)>EPS)current.push(to);
      current.push(...segment.points.slice(1));
    }else{
      linked.push({points:current});
      current=[...segment.points];
    }
  }
  if(current.length)linked.push({points:current});

  return linked.filter(chain=>chain.points.length>=2);
}
