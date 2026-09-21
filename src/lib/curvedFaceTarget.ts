import type { P3 } from './stepView';
import type { ZLevelPerformanceProfile } from './zLevelPerformance';

export type CurvedFaceTriangle={
  a:P3;
  b:P3;
  c:P3;
};

type ProjectedBoundaryEdge={a:P3;b:P3};
type VerticalBoundaryCandidate={faceId:number;triangle:CurvedFaceTriangle};
export type CurvedFaceBoundaryLine={kind:'line';start:P3;end:P3};
export type CurvedFaceBoundaryCircle={kind:'circle';center:P3;axisDirection:P3;radiusMm:number};
export type CurvedFaceBoundaryGeometry=CurvedFaceBoundaryLine|CurvedFaceBoundaryCircle;

type CurvedFaceSpatialIndex={
  minX:number;
  minY:number;
  cellWidth:number;
  cellHeight:number;
  columns:number;
  rows:number;
  cells:number[][];
};

export type CurvedFaceTarget={
  valid:boolean;
  faceIds:number[];
  triangles:CurvedFaceTriangle[];
  bounds:{minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number}|null;
  spatialIndex:CurvedFaceSpatialIndex|null;
  errors:string[];
  warnings:string[];
};

const EPS=1e-8;

function area2(a:P3,b:P3,c:P3){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}

function projectedPointDistance(a:P3,b:P3){return Math.hypot(a.x-b.x,a.y-b.y);}
function projectedPointOnSegment(point:P3,edge:ProjectedBoundaryEdge,tolerance:number){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y;
  const length2=dx*dx+dy*dy;
  if(length2<=EPS*EPS)return projectedPointDistance(point,edge.a)<=tolerance;
  const t=((point.x-edge.a.x)*dx+(point.y-edge.a.y)*dy)/length2;
  if(t<-tolerance||t>1+tolerance)return false;
  const q={x:edge.a.x+t*dx,y:edge.a.y+t*dy,z:0};
  return Math.hypot(point.x-q.x,point.y-q.y)<=tolerance;
}

function edgeKey(a:P3,b:P3,tolerance:number){
  const pointKey=(p:P3)=>`${Math.round(p.x/tolerance)}:${Math.round(p.y/tolerance)}`;
  const ka=pointKey(a),kb=pointKey(b);
  return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
}

function classifyProjectedBoundary(triangles:CurvedFaceTriangle[]){
  const tolerance=1e-7;
  const edges=new Map<string,{edge:ProjectedBoundaryEdge;count:number}>();
  for(const triangle of triangles){
    for(const [a,b] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]] as [P3,P3][]){
      if(projectedPointDistance(a,b)<=tolerance)continue;
      const key=edgeKey(a,b,tolerance),entry=edges.get(key);
      if(entry)entry.count++;
      else edges.set(key,{edge:{a,b},count:1});
    }
  }
  return [...edges.values()].filter(entry=>entry.count===1).map(entry=>entry.edge);
}

function projectedCandidateExtent(candidate:VerticalBoundaryCandidate,tolerance:number):ProjectedBoundaryEdge{
  const points=[candidate.triangle.a,candidate.triangle.b,candidate.triangle.c];
  let a=points[0],b=points[0],maxDistance=-1;
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
    const distance=projectedPointDistance(points[i],points[j]);
    if(distance>maxDistance){maxDistance=distance;a=points[i];b=points[j];}
  }
  return maxDistance<=tolerance?{a,b:a}:{a,b};
}

function segmentCoveredByProjectedBoundary(segment:ProjectedBoundaryEdge,boundaryEdges:ProjectedBoundaryEdge[],tolerance:number){
  const length=projectedPointDistance(segment.a,segment.b);
  if(length<=tolerance)return boundaryEdges.some(edge=>projectedPointOnSegment(segment.a,edge,tolerance));

  // Build a deterministic partition from all candidate/boundary intersections
  // along the candidate line. Every open interval must be covered by at least
  // one collinear outer-boundary edge; endpoint-only coincidence is insufficient.
  const dx=segment.b.x-segment.a.x,dy=segment.b.y-segment.a.y;
  const length2=dx*dx+dy*dy;
  const parameter=(p:P3)=>((p.x-segment.a.x)*dx+(p.y-segment.a.y)*dy)/length2;
  const cross=(p:P3)=>Math.abs(dx*(p.y-segment.a.y)-dy*(p.x-segment.a.x))/length;
  const cuts=[0,1];

  for(const edge of boundaryEdges){
    if(cross(edge.a)>tolerance||cross(edge.b)>tolerance)continue;
    const ta=parameter(edge.a),tb=parameter(edge.b);
    const lo=Math.max(0,Math.min(ta,tb)),hi=Math.min(1,Math.max(ta,tb));
    if(hi<lo-tolerance/Math.max(length,tolerance))continue;
    cuts.push(Math.max(0,Math.min(1,lo)),Math.max(0,Math.min(1,hi)));
  }

  cuts.sort((a,b)=>a-b);
  const unique=cuts.filter((value,index)=>index===0||Math.abs(value-cuts[index-1])>1e-9);
  for(let i=1;i<unique.length;i++){
    const lo=unique[i-1],hi=unique[i];
    if(hi-lo<=1e-9)continue;
    const t=(lo+hi)/2;
    const point:P3={x:segment.a.x+dx*t,y:segment.a.y+dy*t,z:0};
    if(!boundaryEdges.some(edge=>projectedPointOnSegment(point,edge,tolerance)))return false;
  }
  return projectedPointOnSegment(segment.a,segment,tolerance)
    && projectedPointOnSegment(segment.b,segment,tolerance)
    && boundaryEdges.some(edge=>projectedPointOnSegment(segment.a,edge,tolerance))
    && boundaryEdges.some(edge=>projectedPointOnSegment(segment.b,edge,tolerance));
}

function pointOnAnalyticBoundary(point:P3,boundary:CurvedFaceBoundaryGeometry,tolerance:number){
  if(boundary.kind==='line')return projectedPointOnSegment(point,{a:boundary.start,b:boundary.end},tolerance);
  if(Math.abs(Math.abs(boundary.axisDirection.z)-1)>1e-5)return false;
  const radius=Math.hypot(point.x-boundary.center.x,point.y-boundary.center.y);
  return Math.abs(radius-boundary.radiusMm)<=tolerance;
}

function candidateOnAnalyticBoundary(candidate:VerticalBoundaryCandidate,boundaries:CurvedFaceBoundaryGeometry[]){
  const tolerance=1e-6;
  const extent=projectedCandidateExtent(candidate,tolerance);

  // A degenerate display triangle is a tessellation chord/point, not the
  // analytic BRep boundary itself.  Prove ownership by one and the same
  // authorized outer BRep edge.  Requiring chord interior points to lie on a
  // circle would incorrectly reject every non-zero circular tessellation chord.
  return boundaries.some(boundary=>{
    if(boundary.kind==='line'){
      return segmentCoveredByProjectedBoundary(extent,[{a:boundary.start,b:boundary.end}],tolerance);
    }
    if(Math.abs(Math.abs(boundary.axisDirection.z)-1)>1e-5)return false;
    return pointOnAnalyticBoundary(extent.a,boundary,tolerance)
      && pointOnAnalyticBoundary(extent.b,boundary,tolerance);
  });
}

function candidateOnProjectedBoundary(candidate:VerticalBoundaryCandidate,boundaryEdges:ProjectedBoundaryEdge[]){
  const tolerance=1e-6;
  const extent=projectedCandidateExtent(candidate,tolerance);
  // A vertical/XY-degenerate triangle contributes only a projected segment or point.
  // The complete projected extent, not merely its vertices, must be covered by the
  // proven outer boundary. This prevents a chord between separate boundary edges
  // from being accepted as a legitimate vertical boundary.
  return segmentCoveredByProjectedBoundary(extent,boundaryEdges,tolerance);
}

function buildSpatialIndex(triangles:CurvedFaceTriangle[],bounds:NonNullable<CurvedFaceTarget['bounds']>):CurvedFaceSpatialIndex{
  // Uniform XY grid: deterministic acceleration only. Every triangle is
  // registered in every cell touched by its projected AABB, so lookup cannot
  // discard a triangle that the previous exhaustive barycentric test could hit.
  const count=Math.max(1,triangles.length);
  const aspect=Math.max(1e-6,(bounds.maxX-bounds.minX)/Math.max(1e-6,bounds.maxY-bounds.minY));
  const columns=Math.max(1,Math.min(128,Math.ceil(Math.sqrt(count*aspect))));
  const rows=Math.max(1,Math.min(128,Math.ceil(count/columns)));
  const cellWidth=Math.max(EPS,(bounds.maxX-bounds.minX)/columns);
  const cellHeight=Math.max(EPS,(bounds.maxY-bounds.minY)/rows);
  const cells=Array.from({length:columns*rows},()=>[] as number[]);
  const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,Math.floor(v)));
  triangles.forEach((triangle,index)=>{
    const minX=Math.min(triangle.a.x,triangle.b.x,triangle.c.x),maxX=Math.max(triangle.a.x,triangle.b.x,triangle.c.x);
    const minY=Math.min(triangle.a.y,triangle.b.y,triangle.c.y),maxY=Math.max(triangle.a.y,triangle.b.y,triangle.c.y);
    const x0=clamp((minX-bounds.minX)/cellWidth,columns-1),x1=clamp((maxX-bounds.minX)/cellWidth,columns-1);
    const y0=clamp((minY-bounds.minY)/cellHeight,rows-1),y1=clamp((maxY-bounds.minY)/cellHeight,rows-1);
    for(let row=y0;row<=y1;row++)for(let column=x0;column<=x1;column++)cells[row*columns+column].push(index);
  });
  return{minX:bounds.minX,minY:bounds.minY,cellWidth,cellHeight,columns,rows,cells};
}

function candidateTriangleIndices(target:CurvedFaceTarget,x:number,y:number):number[]|null{
  const index=target.spatialIndex,bounds=target.bounds;
  if(!index||!bounds)return null;
  if(x<bounds.minX-EPS||x>bounds.maxX+EPS||y<bounds.minY-EPS||y>bounds.maxY+EPS)return[];
  const column=Math.max(0,Math.min(index.columns-1,Math.floor((x-index.minX)/index.cellWidth)));
  const row=Math.max(0,Math.min(index.rows-1,Math.floor((y-index.minY)/index.cellHeight)));
  return index.cells[row*index.columns+column];
}

function barycentricXY(t:CurvedFaceTriangle,x:number,y:number){
  const {a,b,c}=t;
  const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<=EPS)return null;
  const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
  const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
  const w=1-u-v;
  if(u<-1e-7||v<-1e-7||w<-1e-7)return null;
  return{u,v,w};
}


export function translateCurvedFaceTarget(
  target:CurvedFaceTarget,
  offset:{x:number;y:number;z:number},
):CurvedFaceTarget{
  if(!target.valid||!target.bounds)return target;
  const shift=(point:P3):P3=>({x:point.x+offset.x,y:point.y+offset.y,z:point.z+offset.z});
  const triangles=target.triangles.map(triangle=>({a:shift(triangle.a),b:shift(triangle.b),c:shift(triangle.c)}));
  const bounds={
    minX:target.bounds.minX+offset.x,maxX:target.bounds.maxX+offset.x,
    minY:target.bounds.minY+offset.y,maxY:target.bounds.maxY+offset.y,
    minZ:target.bounds.minZ+offset.z,maxZ:target.bounds.maxZ+offset.z,
  };
  return{
    ...target,
    triangles,
    bounds,
    spatialIndex:buildSpatialIndex(triangles,bounds),
  };
}

export function curvedFaceTargetZAt(
  target:CurvedFaceTarget,
  x:number,
  y:number,
  profile?:ZLevelPerformanceProfile,
):number|null{
  if(!target.valid)return null;
  let hit:number|null=null;

  const candidates=candidateTriangleIndices(target,x,y);
  const triangleIndices=candidates??target.triangles.map((_,index)=>index);
  for(const index of triangleIndices){
    const triangle=target.triangles[index];
    if(profile)profile.curvedTargetTriangleTests++;
    const bc=barycentricXY(triangle,x,y);
    if(!bc)continue;
    const z=bc.u*triangle.a.z+bc.v*triangle.b.z+bc.w*triangle.c.z;
    if(hit===null){
      hit=z;
      continue;
    }

    // A selected surface used by 3-axis top machining must be single-valued
    // in XY. Two materially different Z values at the same XY point indicate
    // an overhang / vertical fold and are not a valid curved face target.
    if(Math.abs(hit-z)>1e-4)return null;
  }

  return hit;
}

export function buildCurvedFaceTarget(
  partTriangles:P3[],
  displayFaceIds:number[],
  selectedFaceIds:number[],
  profile?:ZLevelPerformanceProfile,
  brepOuterBoundaryGeometry?:CurvedFaceBoundaryGeometry[],
):CurvedFaceTarget{
  const errors:string[]=[];
  const warnings:string[]=[];
  const selected=new Set(selectedFaceIds);
  const boundaryDiagnostics:CurvedFaceTarget['boundaryDiagnostics']=[];

  if(!selected.size)errors.push('Keine STEP/BRep-Fläche ausgewählt.');
  if(displayFaceIds.length!==Math.floor(partTriangles.length/3)){
    errors.push('STEP/BRep Face-ID-Zuordnung ist unvollständig.');
  }

  const triangles:CurvedFaceTriangle[]=[];
  const verticalBoundaryCandidates:VerticalBoundaryCandidate[]=[];
  for(let i=0;i+2<partTriangles.length;i+=3){
    const faceId=displayFaceIds[Math.floor(i/3)];
    if(!selected.has(faceId))continue;
    const a=partTriangles[i],b=partTriangles[i+1],c=partTriangles[i+2];

    // Regular triangles define z(x,y). XY-degenerate triangles cannot define a
    // height-field patch themselves; retain them for an explicit outer-boundary proof.
    if(Math.abs(area2(a,b,c))<=EPS){
      verticalBoundaryCandidates.push({faceId,triangle:{a,b,c}});
      continue;
    }
    triangles.push({a,b,c});
  }

  // Native BRep outer-wire topology plus analytic edge geometry is authoritative when supplied.
  const meshBoundaryEdges=brepOuterBoundaryGeometry?null:classifyProjectedBoundary(triangles);
  for(const candidate of verticalBoundaryCandidates){
    const proven=brepOuterBoundaryGeometry
      ?candidateOnAnalyticBoundary(candidate,brepOuterBoundaryGeometry)
      :candidateOnProjectedBoundary(candidate,meshBoundaryEdges??[]);
    if(!proven){
      boundaryDiagnostics.push({
        faceId:candidate.faceId,
        candidatePoints:[candidate.triangle.a,candidate.triangle.b,candidate.triangle.c].map(point=>({...point})),
        outerBoundaryEdges:(brepOuterBoundaryGeometry??[]).map(edge=>({wireId:edge.wireId??null,edgeId:edge.edgeId??null,kind:edge.kind})),
      });
      errors.push(`Ausgewählte Fläche ${candidate.faceId}: vertikale oder XY-degenerierte Dreiecksprojektion liegt nicht nachweisbar auf der äußeren XY-Boundary.`);
    }
  }

  if(!triangles.length&&!errors.length){
    errors.push('Die ausgewählte STEP/BRep-Fläche enthält keine Triangulation.');
  }

  let bounds:CurvedFaceTarget['bounds']=null;
  let spatialIndex:CurvedFaceSpatialIndex|null=null;
  if(triangles.length){
    const points=triangles.flatMap(t=>[t.a,t.b,t.c]);
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
    bounds={
      minX:Math.min(...xs),maxX:Math.max(...xs),
      minY:Math.min(...ys),maxY:Math.max(...ys),
      minZ:Math.min(...zs),maxZ:Math.max(...zs),
    };

    spatialIndex=buildSpatialIndex(triangles,bounds);

    if(bounds.maxZ-bounds.minZ<=1e-4){
      warnings.push('Die ausgewählte Fläche ist praktisch planar; Curved Face Target ist dafür nicht erforderlich.');
    }

    // Conservative single-valued proof on a regular sample lattice.
    const nx=24,ny=24;
    for(let iy=0;iy<=ny;iy++){
      const y=bounds.minY+(bounds.maxY-bounds.minY)*iy/ny;
      for(let ix=0;ix<=nx;ix++){
        const x=bounds.minX+(bounds.maxX-bounds.minX)*ix/nx;
        let hit:number|null=null;
        const candidates=spatialIndex?candidateTriangleIndices({valid:true,faceIds:[],triangles,bounds,spatialIndex,errors:[],warnings:[],boundaryDiagnostics:[]},x,y):null;
        const triangleIndices=candidates??triangles.map((_,index)=>index);
        for(const triangleIndex of triangleIndices){
          const triangle=triangles[triangleIndex];
          if(profile)profile.curvedTargetTriangleTests++;
          const bc=barycentricXY(triangle,x,y);
          if(!bc)continue;
          const z=bc.u*triangle.a.z+bc.v*triangle.b.z+bc.w*triangle.c.z;
          if(hit===null)hit=z;
          else if(Math.abs(hit-z)>1e-4){
            errors.push(`Ausgewählte Fläche ist bei X ${x.toFixed(3)} / Y ${y.toFixed(3)} mm nicht eindeutig als Z(x,y) definiert.`);
            iy=ny+1;
            break;
          }
        }
      }
    }
  }

  return{
    valid:errors.length===0&&triangles.length>0,
    faceIds:[...selected],
    triangles,
    bounds,
    spatialIndex,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    boundaryDiagnostics,
  };
}
