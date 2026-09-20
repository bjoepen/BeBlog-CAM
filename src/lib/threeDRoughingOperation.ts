import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildThreeDSurfaceTargetState } from './threeDSurfaceTargetState';
import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  ThreeDRoughingOperation,
  WorkCoordinateSystem,
} from './types';

export type ThreeDRoughingOperationState={
  ok:boolean;
  target:CurvedFaceTarget|null;
  toolpath:null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
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

  // 008H-A2 intentionally stops at shared Surface Truth. A valid target is
  // observable to the operation state, but no manufacturing toolpath exists
  // until the dedicated 3D roughing strategy is accepted.
  if(surface.ok&&surface.target)warnings.push('008H-A2: 3D Surface Truth gültig; Manufacturing-Toolpath bleibt bis zum freigegebenen Schrupp-Kernel gesperrt.');

  return{
    ok:errors.length===0&&surface.ok&&surface.target!==null,
    target:errors.length===0&&surface.ok?surface.target:null,
    toolpath:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:surface.triangleCount,
  };
}
