import { buildThreeDRoughingOperationState } from './threeDRoughingOperation';
import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  ThreeDRoughingOperation,
  WorkCoordinateSystem,
} from './types';

export type ThreeDRoughingDeterminismSignature={
  ok:boolean;
  toolpathPresent:boolean;
  runCount:number;
  pointCount:number;
  errorCount:number;
  warningCount:number;
};

export type ThreeDRoughingProductionDeterminismProbe={
  diameterA:number;
  diameterB:number;
  firstA:ThreeDRoughingDeterminismSignature;
  middleB:ThreeDRoughingDeterminismSignature;
  secondA:ThreeDRoughingDeterminismSignature;
  deterministic:boolean;
};

function signature(state:ReturnType<typeof buildThreeDRoughingOperationState>):ThreeDRoughingDeterminismSignature{
  const runs=state.toolpath?.runs??[];
  return{
    ok:state.ok,
    toolpathPresent:state.toolpath!==null,
    runCount:runs.length,
    pointCount:runs.reduce((sum,run)=>sum+run.points.length,0),
    errorCount:state.errors.length,
    warningCount:state.warnings.length,
  };
}

function same(a:ThreeDRoughingDeterminismSignature,b:ThreeDRoughingDeterminismSignature){
  return JSON.stringify(a)===JSON.stringify(b);
}

/**
 * 008H-A22: production-builder determinism probe.
 *
 * The exact same production inputs are used for A before and after an
 * intervening B build. This deliberately bypasses Svelte state and calls the
 * real 3D-roughing operation builder three times:
 *
 *   A -> B -> A
 *
 * It changes no manufacturing state and approves no geometry.
 */
export function buildThreeDRoughingProductionDeterminismProbe(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:ThreeDRoughingOperation;
  diameterA?:number;
  diameterB?:number;
}):ThreeDRoughingProductionDeterminismProbe{
  const diameterA=args.diameterA??6;
  const diameterB=args.diameterB??3;
  const operationA:ThreeDRoughingOperation={...args.operation,tool:{...args.operation.tool,diameterMm:diameterA}};
  const operationB:ThreeDRoughingOperation={...args.operation,tool:{...args.operation.tool,diameterMm:diameterB}};
  const build=(operation:ThreeDRoughingOperation)=>buildThreeDRoughingOperationState({
    summary:args.summary,
    stock:args.stock,
    placement:args.placement,
    orientation:args.orientation,
    wcs:args.wcs,
    operation,
  });

  const firstA=signature(build(operationA));
  const middleB=signature(build(operationB));
  const secondA=signature(build(operationA));
  return{diameterA,diameterB,firstA,middleB,secondA,deterministic:same(firstA,secondA)};
}

export function emitThreeDRoughingProductionDeterminismProbe(probe:ThreeDRoughingProductionDeterminismProbe){
  console.info('[008H-A22][3D-production-determinism]',probe);
}
