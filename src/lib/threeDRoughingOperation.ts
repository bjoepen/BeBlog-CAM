import type { CurvedFaceTarget } from './curvedFaceTarget';
import { translateCurvedFaceTarget } from './curvedFaceTarget';
import { buildPlacedPartTriangles, buildThreeDSurfaceTargetState } from './threeDSurfaceTargetState';
import { buildPartSafetySurface, translatePartSafetySurface } from './partSafetySurface';
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
  return translateCurvedFaceTarget(target,{x:-origin.x,y:-origin.y,z:-origin.z});
}

export type ThreeDRoughingOperationState={
  ok:boolean;
  target:CurvedFaceTarget|null;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
  safetyProbeCount:number;
  boundaryDiagnostics:import('./curvedFaceTarget').CurvedFaceTarget['boundaryDiagnostics'];
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
    const origin=wcsOrigin(stock,wcs);
    const wcsTarget=targetInWcs(surface.target,origin);
    const placedPart=buildPlacedPartTriangles(summary,stock,placement,orientation);
    const partSafety=placedPart?translatePartSafetySurface(buildPartSafetySurface(placedPart),{x:-origin.x,y:-origin.y,z:-origin.z}):null;
    if(!wcsTarget.valid){
      errors.push(...wcsTarget.errors);
      warnings.push(...wcsTarget.warnings);
    }
    if(!partSafety||!partSafety.valid)errors.push(...(partSafety?.errors??['Part Safety Truth konnte nicht aus der STEP/BRep-Triangulation aufgebaut werden.']));
    const pipeline=wcsTarget.valid&&partSafety?.valid?buildThreeDRoughingPipeline({target:wcsTarget,partSafety,stock,wcs,operation}):null;
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
    boundaryDiagnostics:surface.boundaryDiagnostics,
  };
}
