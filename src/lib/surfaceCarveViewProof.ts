import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { CurvedFaceTarget } from './curvedFaceTarget';
import { projectCarveToolpathToSurface } from './surfaceCarveProjection';

export type SurfaceCarveViewProof={
  ok:boolean;
  paths:ToolpathPoint3[][];
  errors:string[];
};

export function buildSurfaceCarveViewProof(target:CurvedFaceTarget):SurfaceCarveViewProof{
  if(!target.valid||!target.bounds)return{ok:false,paths:[],errors:target.errors.length?target.errors:['Keine gültige STEP-Zielfläche gewählt.']};
  const b=target.bounds;
  const width=b.maxX-b.minX,height=b.maxY-b.minY;
  if(width<=1e-6||height<=1e-6)return{ok:false,paths:[],errors:['STEP-Zielfläche besitzt keine projizierbare XY-Ausdehnung.']};

  const left=b.minX+width*.24,right=b.maxX-width*.24;
  const bottom=b.minY+height*.24,top=b.maxY-height*.24;
  const midX=(left+right)/2,midY=(bottom+top)/2;
  const points:ToolpathPoint2[]=[
    {x:left,y:top},
    {x:midX,y:bottom},
    {x:right,y:top},
    {x:left,y:midY},
    {x:right,y:midY},
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
  const projected=projectCarveToolpathToSurface(toolpath,target,{sampleSpacingMm:.35});
  if(!projected.ok)return{ok:false,paths:[],errors:projected.errors};

  // Rendering-only lift avoids z-fighting. Projection data itself remains on Z(x,y).
  return{ok:true,paths:projected.runs.map(run=>run.points.map(point=>({...point,z:point.z+.09}))),errors:[]};
}
