import type { CanonicalToolpath } from './canonicalToolpath';
import type { CamOperation, OperationsProject } from './types';

export type ThreeDRoughingAppDiagnosticSnapshot={
  event:string;
  operationId:string;
  localTool:{id:string;diameterMm:number}|null;
  projectTool:{id:string;diameterMm:number}|null;
  canonical:{operationKind:string;runCount:number;pointCount:number}|null;
  localProjectMatch:boolean;
};

function toolOf(operation:CamOperation|undefined|null){
  return operation?.kind==='3d-roughing'?{id:operation.tool.id,diameterMm:operation.tool.diameterMm}:null;
}
function canonicalOf(toolpath:CanonicalToolpath|null){
  return toolpath?{operationKind:toolpath.operationKind,runCount:toolpath.runs.length,pointCount:toolpath.runs.reduce((sum,run)=>sum+run.points.length,0)}:null;
}
export function captureThreeDRoughingAppDiagnostic(input:{
  event:string;operation:CamOperation;project:OperationsProject;canonical:CanonicalToolpath|null;
}):ThreeDRoughingAppDiagnosticSnapshot|null{
  if(input.operation.kind!=='3d-roughing')return null;
  const projectOperation=input.project.operations.find(candidate=>candidate.id===input.operation.id);
  const localTool=toolOf(input.operation),projectTool=toolOf(projectOperation);
  return{
    event:input.event,operationId:input.operation.id,localTool,projectTool,canonical:canonicalOf(input.canonical),
    localProjectMatch:!!localTool&&!!projectTool&&localTool.id===projectTool.id&&localTool.diameterMm===projectTool.diameterMm,
  };
}
export function emitThreeDRoughingAppDiagnostic(snapshot:ThreeDRoughingAppDiagnosticSnapshot|null){
  if(snapshot)console.info('[008H-A21][3D-roughing-state]',snapshot);
}
export function emitThreeDRoughingBoundaryDiagnostics(input:{operationId:string;diagnostics:unknown[]}){
  if(input.diagnostics.length)console.info('[008H-A21][3D-boundary]',{operationId:input.operationId,diagnostics:input.diagnostics});
}
