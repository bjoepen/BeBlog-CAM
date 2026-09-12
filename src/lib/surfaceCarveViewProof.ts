import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { CurvedFaceTarget, CurvedFaceTriangle } from './curvedFaceTarget';
import { projectCarveToolpathToSurface } from './surfaceCarveProjection';

export type SurfaceCarveViewProof={
  ok:boolean;
  paths:ToolpathPoint3[][];
  errors:string[];
};

function projectedArea2(triangle:CurvedFaceTriangle){
  const {a,b,c}=triangle;
  return Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));
}

function barycentricPoint(triangle:CurvedFaceTriangle,u:number,v:number,w:number):ToolpathPoint2{
  return{
    x:triangle.a.x*u+triangle.b.x*v+triangle.c.x*w,
    y:triangle.a.y*u+triangle.b.y*v+triangle.c.y*w,
  };
}

export function buildSurfaceCarveViewProof(target:CurvedFaceTarget):SurfaceCarveViewProof{
  if(!target.valid||!target.bounds)return{ok:false,paths:[],errors:target.errors.length?target.errors:['Keine gültige STEP-Zielfläche gewählt.']};

  // Build the diagnostic motif inside one real projected STEP triangle rather
  // than inside the target bounding box. A bounding box may contain XY regions
  // that are not part of a curved/trimmed face; the projection adapter must
  // correctly fail closed there. Any straight segment between points inside a
  // triangle remains inside that triangle, so this fixture exercises the real
  // projection without accidentally leaving the selected surface.
  const triangle=target.triangles.reduce<CurvedFaceTriangle|null>((best,current)=>{
    if(!best)return current;
    return projectedArea2(current)>projectedArea2(best)?current:best;
  },null);
  if(!triangle||projectedArea2(triangle)<=1e-8){
    return{ok:false,paths:[],errors:['STEP-Zielfläche besitzt kein ausreichend großes projizierbares Dreieck für den 007A-Sichtnachweis.']};
  }

  // A compact zig-zag motif using strictly positive barycentric weights. The
  // points stay comfortably away from triangle edges and therefore tolerate
  // tessellation/float noise while still spanning a useful part of the face.
  const points:ToolpathPoint2[]=[
    barycentricPoint(triangle,.68,.18,.14),
    barycentricPoint(triangle,.18,.68,.14),
    barycentricPoint(triangle,.18,.18,.64),
    barycentricPoint(triangle,.54,.30,.16),
  ];
  const segments:CanonicalToolpathSegment[]=points.slice(1).map((end,index)=>({kind:'line',start:points[index],end}));
  const toolpath:CanonicalToolpath={
    version:1,
    operationKind:'carve',
    strategy:'carve',
    tool:{diameterMm:1},
    stepoverPercent:0,
    runs:[{kind:'cut',z:0,points,segments,retractAfter:true}],
  };
  const projected=projectCarveToolpathToSurface(toolpath,target,{sampleSpacingMm:.20});
  if(!projected.ok)return{ok:false,paths:[],errors:projected.errors};

  // Rendering-only lift avoids z-fighting. Projection data itself remains on Z(x,y).
  // The larger 0.35 mm lift is diagnostic only and deliberately makes the proof
  // distinguishable from the existing +0.04 mm curved-face sampling grid.
  return{ok:true,paths:projected.runs.map(run=>run.points.map(point=>({...point,z:point.z+.35}))),errors:[]};
}
