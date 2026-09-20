import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildThreeDSurfaceTargetState } from './threeDSurfaceTargetState';
import { endMillRoughingSafetyAt } from './endMillRoughingSafety';
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

  // 008H-A2 intentionally stops at shared Surface Truth. A valid target is
  // observable to the operation state, but no manufacturing toolpath exists
  // until the dedicated 3D roughing strategy is accepted.
  let safetyProbeCount=0;
  if(surface.ok&&surface.target&&surface.target.bounds&&operation.tool.diameterMm>0&&operation.finishAllowanceMm>=0){
    const b=surface.target.bounds;
    const probes=[
      {x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},
      {x:b.minX+(b.maxX-b.minX)*.25,y:b.minY+(b.maxY-b.minY)*.25},
      {x:b.minX+(b.maxX-b.minX)*.75,y:b.minY+(b.maxY-b.minY)*.75},
    ];
    for(const probe of probes){
      const safety=endMillRoughingSafetyAt(surface.target,probe.x,probe.y,operation.tool.diameterMm/2,operation.finishAllowanceMm);
      if(safety.valid)safetyProbeCount++;
    }
    warnings.push(`008H-A3: 3D Surface Truth gültig; ${safetyProbeCount}/${probes.length} konservative Schaftfräser-Sicherheitsproben gültig. Manufacturing-Toolpath bleibt gesperrt.`);
  }

  return{
    ok:errors.length===0&&surface.ok&&surface.target!==null,
    target:errors.length===0&&surface.ok?surface.target:null,
    toolpath:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:surface.triangleCount,
    safetyProbeCount,
  };
}
