import type { ZLevelChain, ZLevelSlice, ZPoint2 } from './zLevelSlice';

export type ModelSliceLoop={
  points:ZPoint2[];
  signedArea:number;
  area:number;
  depth:number;
};

export type ModelSliceIsland={
  outer:ModelSliceLoop;
  holes:ModelSliceLoop[];
};

export type ModelSliceRegion={
  z:number;
  valid:boolean;
  islands:ModelSliceIsland[];
  closedLoopCount:number;
  openChainCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;

const same=(a:ZPoint2,b:ZPoint2,tol=1e-6)=>Math.hypot(a.x-b.x,a.y-b.y)<=tol;

function normalizedLoop(chain:ZLevelChain):ZPoint2[]{
  const points=chain.points.map(p=>({x:p.x,y:p.y}));
  while(points.length>1&&same(points[0],points[points.length-1]))points.pop();
  return points;
}

function signedArea(points:ZPoint2[]){
  let area=0;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    area+=points[j].x*points[i].y-points[i].x*points[j].y;
  }
  return area/2;
}

function pointOnSegment(p:ZPoint2,a:ZPoint2,b:ZPoint2){
  const cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
  if(Math.abs(cross)>1e-6)return false;
  const dot=(p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y);
  if(dot<-EPS)return false;
  const len2=(b.x-a.x)**2+(b.y-a.y)**2;
  return dot<=len2+EPS;
}

function pointInPolygon(points:ZPoint2[],p:ZPoint2){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    if(pointOnSegment(p,a,b))return true;
    const hit=((a.y>p.y)!==(b.y>p.y))&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x;
    if(hit)inside=!inside;
  }
  return inside;
}

function orient(a:ZPoint2,b:ZPoint2,c:ZPoint2){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function properSegmentIntersection(a:ZPoint2,b:ZPoint2,c:ZPoint2,d:ZPoint2){
  const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
  return ((o1>EPS&&o2<-EPS)||(o1<-EPS&&o2>EPS))&&
    ((o3>EPS&&o4<-EPS)||(o3<-EPS&&o4>EPS));
}

function selfIntersects(points:ZPoint2[]){
  const n=points.length;
  for(let i=0;i<n;i++){
    const a=points[i],b=points[(i+1)%n];
    for(let j=i+1;j<n;j++){
      if(j===i||j===(i+1)%n||i===(j+1)%n)continue;
      if(i===0&&j===n-1)continue;
      const c=points[j],d=points[(j+1)%n];
      if(properSegmentIntersection(a,b,c,d))return true;
    }
  }
  return false;
}

function loopsCross(a:ZPoint2[],b:ZPoint2[]){
  for(let i=0;i<a.length;i++){
    const a0=a[i],a1=a[(i+1)%a.length];
    for(let j=0;j<b.length;j++){
      const b0=b[j],b1=b[(j+1)%b.length];
      if(properSegmentIntersection(a0,a1,b0,b1))return true;
    }
  }
  return false;
}

function representative(points:ZPoint2[]){
  // A contour vertex is sufficient for nesting because intersecting/touching
  // loops are rejected before containment classification.
  return points[0];
}

export function buildModelSliceRegion(slice:ZLevelSlice):ModelSliceRegion{
  const errors:string[]=[];
  const warnings:string[]=[];
  const open=slice.chains.filter(chain=>!chain.closed);
  const closed=slice.chains.filter(chain=>chain.closed);

  if(open.length)errors.push(`${open.length} offene Schnittkette${open.length===1?'':'n'}: Modellregion ist nicht geschlossen.`);

  const loops:ModelSliceLoop[]=closed.flatMap((chain,index)=>{
    const points=normalizedLoop(chain);
    if(points.length<3){
      errors.push(`Geschlossene Schnittkette ${index+1} besitzt weniger als 3 eindeutige Punkte.`);
      return[];
    }
    const sa=signedArea(points),area=Math.abs(sa);
    if(area<=EPS){
      errors.push(`Geschlossene Schnittkette ${index+1} besitzt keine belastbare Fläche.`);
      return[];
    }
    if(selfIntersects(points)){
      errors.push(`Geschlossene Schnittkette ${index+1} schneidet sich selbst.`);
      return[];
    }
    return[{points,signedArea:sa,area,depth:0}];
  });

  for(let i=0;i<loops.length;i++)for(let j=i+1;j<loops.length;j++){
    if(loopsCross(loops[i].points,loops[j].points)){
      errors.push(`Schnittkonturen ${i+1} und ${j+1} kreuzen sich.`);
    }
  }

  if(!closed.length&&!open.length)warnings.push('Z-Ebene enthält keine Modellschnittkontur.');
  if(closed.length&&!loops.length)errors.push('Keine belastbare geschlossene Modellkontur vorhanden.');

  if(errors.length){
    return{
      z:slice.z,
      valid:false,
      islands:[],
      closedLoopCount:closed.length,
      openChainCount:open.length,
      errors:[...new Set(errors)],
      warnings,
    };
  }

  // Even/odd nesting contract:
  // depth 0,2,4... = material islands
  // depth 1,3,5... = holes in their nearest even-depth parent.
  for(const loop of loops){
    const p=representative(loop.points);
    loop.depth=loops.reduce((depth,candidate)=>{
      if(candidate===loop||candidate.area<=loop.area+EPS)return depth;
      return depth+(pointInPolygon(candidate.points,p)?1:0);
    },0);
  }

  const islands:ModelSliceIsland[]=[];
  for(const outer of loops.filter(loop=>loop.depth%2===0).sort((a,b)=>b.area-a.area)){
    const holes=loops
      .filter(loop=>loop.depth===outer.depth+1&&pointInPolygon(outer.points,representative(loop.points)))
      .filter(loop=>{
        // Hole belongs to the smallest containing even-depth island.
        const containing=loops.filter(candidate=>
          candidate.depth%2===0 &&
          candidate.depth===outer.depth &&
          candidate.area<outer.area-EPS &&
          pointInPolygon(candidate.points,representative(loop.points))
        );
        return containing.length===0;
      })
      .sort((a,b)=>b.area-a.area);
    islands.push({outer,holes});
  }

  return{
    z:slice.z,
    valid:true,
    islands,
    closedLoopCount:closed.length,
    openChainCount:0,
    errors:[],
    warnings,
  };
}

export function buildModelSliceRegions(slices:ZLevelSlice[]):ModelSliceRegion[]{
  return slices.map(buildModelSliceRegion);
}
