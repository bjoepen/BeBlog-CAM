import type { ImportSummary, OperationsProject, SurfaceCarveOperation, ZLevelRoughingOperation } from './types';

export type SurfaceCarveEligibility={
  ok:boolean;
  errors:string[];
  eligibleRoughingOperations:ZLevelRoughingOperation[];
};

export type SurfaceCarveOperationValidation={
  ok:boolean;
  errors:string[];
  roughingOperation:ZLevelRoughingOperation|null;
};

function earlierOperations(project:OperationsProject,operationId:string){
  const index=project.operations.findIndex(operation=>operation.id===operationId);
  return index<0?[]:project.operations.slice(0,index);
}

function isFaceTargetRoughing(operation:OperationsProject['operations'][number]):operation is ZLevelRoughingOperation{
  return operation.kind==='z-level-roughing'&&operation.enabled!==false&&(operation.roughingMode??'face-target')==='face-target';
}

export function eligibleSurfaceCarveRoughingOperations(args:{
  summary:ImportSummary;
  project:OperationsProject;
  surfaceCarveOperationId:string;
  faceId:number|null;
  successfulOperationIds:ReadonlySet<string>;
}):SurfaceCarveEligibility{
  const errors:string[]=[];
  if(args.summary.kind!=='step')errors.push('Surface Carve ist ausschließlich auf einem STEP/BRep-Bauteil verfügbar.');
  if(args.faceId===null)errors.push('Surface Carve benötigt genau eine ausgewählte STEP-Fläche.');

  const eligible=args.faceId===null?[]:earlierOperations(args.project,args.surfaceCarveOperationId)
    .filter(isFaceTargetRoughing)
    .filter(operation=>operation.faceIds.includes(args.faceId!))
    .filter(operation=>args.successfulOperationIds.has(operation.id));

  if(args.faceId!==null&&!eligible.length){
    errors.push('Surface Carve benötigt davor eine erfolgreiche eigenständige Z-Level-Schruppoperation für dieselbe STEP-Fläche.');
  }

  return{ok:errors.length===0,errors,eligibleRoughingOperations:eligible};
}

export function validateSurfaceCarveOperation(args:{
  summary:ImportSummary;
  project:OperationsProject;
  operation:SurfaceCarveOperation;
  successfulOperationIds:ReadonlySet<string>;
  requireGeometrySource?:boolean;
}):SurfaceCarveOperationValidation{
  const {operation}=args;
  const eligibility=eligibleSurfaceCarveRoughingOperations({
    summary:args.summary,
    project:args.project,
    surfaceCarveOperationId:operation.id,
    faceId:operation.faceId,
    successfulOperationIds:args.successfulOperationIds,
  });
  const errors=[...eligibility.errors];

  if(args.requireGeometrySource!==false&&!operation.geometrySourceId){
    errors.push('Surface Carve benötigt eine unter Bearbeiten geladene sekundäre 2D-Geometrie.');
  }

  const selected=operation.roughingOperationId
    ?eligibility.eligibleRoughingOperations.find(candidate=>candidate.id===operation.roughingOperationId)??null
    :null;
  if(eligibility.eligibleRoughingOperations.length&&operation.roughingOperationId===null){
    errors.push('Surface Carve muss explizit auf die vorherige Z-Level-Schruppoperation verweisen.');
  }else if(operation.roughingOperationId&&!selected){
    errors.push('Die zugeordnete Z-Level-Schruppoperation liegt nicht erfolgreich vor Surface Carve oder bearbeitet nicht dieselbe STEP-Fläche.');
  }

  if(!(operation.totalDepthMm>0&&Number.isFinite(operation.totalDepthMm)))errors.push('Surface-Carve-Tiefe muss größer als 0 sein.');
  if(!(operation.feedMmMin>0&&Number.isFinite(operation.feedMmMin)))errors.push('Surface-Carve-Vorschub muss größer als 0 sein.');
  if(!(operation.plungeMmMin>0&&Number.isFinite(operation.plungeMmMin)))errors.push('Surface-Carve-Eintauchvorschub muss größer als 0 sein.');

  return{ok:errors.length===0,errors:[...new Set(errors)],roughingOperation:selected};
}
