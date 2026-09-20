import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildCurvedFaceTarget } from './curvedFaceTarget';
import { buildThreeDSurfaceTargetState } from './threeDSurfaceTargetState';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { P3 } from './stepView';
import { buildThreeDRoughingPipeline } from './threeDRoughingPipeline';
import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  ThreeDRoughingOperation,
  WorkCoordinateSystem,
} from './types';

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{
  return{x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,z:wcs.z==='top'?stock.thickness:0};
}

function targetInWcs(target:CurvedFaceTarget,origin:P3):CurvedFaceTarget{
  const triangles=target.triangles.flatMap(triangle=>[
    {x:triangle.a.x-origin.x,y:triangle.a.y-origin.y,z:triangle.a.z-origin.z},
    {x:triangle.b.x-origin.x,y:triangle.b.y-origin.y,z:triangle.b.z-origin.z},
    {x:triangle.c.x-origin.x,y:triangle.c.y-origin.y,z:triangle.c.z-origin.z},
  ]);
  const faceIds=target.triangles.flatMap((_,index)=>[target.faceIds[index]??target.faceIds[0]??-1]);
  // Rebuild through the shared Surface Truth constructor so bounds and spatial
  // index are transformed together; never mutate only target.bounds.
  return buildCurvedFaceTarget(triangles,faceIds,target.faceIds);
}

export type ThreeDRoughingOperationState={
  ok:boolean;
  target:CurvedFaceTarget|null;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
  safetyProbeCount:number;
};

export function buildThreeDRoughingOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:ThreeDRoughingOperation;
}):ThreeDRoughingOperationState{
  const {summary,stock,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];

  if(wcs.z!=='top')errors.push('3D Schruppen benötigt WCS Z auf der Rohlingoberseite.');
  if(operation.tool.kind!=='end-mill')errors.push('3D Schruppen v1 benötigt einen Schaftfräser.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');

  const surface=buildThreeDSurfaceTargetState({
    summary,
    stock,
    placement,
    orientation,
    faceIds:operation.faceIds,
    operationLabel:'3D Schruppen',
  });
  warnings.push(...surface.warnings);
  errors.push(...surface.errors);

  let toolpath:CanonicalToolpath|null=null;
  let safetyProbeCount=0;
  if(errors.length===0&&surface.ok&&surface.target){
    const wcsTarget=targetInWcs(surface.target,wcsOrigin(stock,wcs));
    if(!wcsTarget.valid){
      errors.push(...wcsTarget.errors);
      warnings.push(...wcsTarget.warnings);
    }
    const pipeline=wcsTarget.valid?buildThreeDRoughingPipeline({target:wcsTarget,stock,wcs,operation}):null;
    if(pipeline){
      warnings.push(...pipeline.warnings);
      errors.push(...pipeline.errors);
      if(pipeline.ok&&pipeline.toolpath)toolpath=pipeline.toolpath;
      else if(pipeline.ok&&!pipeline.toolpath)errors.push('3D Schruppen: Kein bewiesener Manufacturing-Schnitt auf den geplanten Z-Leveln.');
    }
  }
  return{
    ok:errors.length===0&&surface.ok&&surface.target!==null,
    target:errors.length===0&&surface.ok?surface.target:null,
    toolpath:errors.length===0?toolpath:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:surface.triangleCount,
    safetyProbeCount,
  };
}
