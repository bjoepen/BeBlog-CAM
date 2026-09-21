import type { ThreeDRoughingOperationState } from './threeDRoughingOperation';
import { buildThreeDRoughingOperationState } from './threeDRoughingOperation';
import type { ImportSummary,PartOrientation,PartPlacement,StockDefinition,ThreeDRoughingOperation,WorkCoordinateSystem } from './types';

export function threeDRoughingDeterminismSignature(state:ThreeDRoughingOperationState):string{
  return JSON.stringify({
    ok:state.ok,
    errors:state.errors,
    warnings:state.warnings,
    runs:state.toolpath?.runs.map(run=>({z:run.z,points:run.points}))??null,
  });
}

export function buildThreeDRoughingDeterminismProbe(args:{
  summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;
  operationA:ThreeDRoughingOperation;operationB:ThreeDRoughingOperation;
}){
  const common={summary:args.summary,stock:args.stock,placement:args.placement,orientation:args.orientation,wcs:args.wcs};
  const firstA=threeDRoughingDeterminismSignature(buildThreeDRoughingOperationState({...common,operation:args.operationA}));
  const middleB=threeDRoughingDeterminismSignature(buildThreeDRoughingOperationState({...common,operation:args.operationB}));
  const secondA=threeDRoughingDeterminismSignature(buildThreeDRoughingOperationState({...common,operation:args.operationA}));
  return{deterministic:firstA===secondA,firstA,middleB,secondA};
}

export function describeRejectedVerticalBoundaryCandidate(input:{
  faceId:number;
  candidate:{points:{x:number;y:number;z:number}[]};
  boundaries:{wireId:number;edgeId:number;kind:string;start?:{x:number;y:number;z:number};end?:{x:number;y:number;z:number};center?:{x:number;y:number;z:number};radiusMm?:number}[];
}){
  return{
    faceId:input.faceId,
    candidatePoints:input.candidate.points.map(p=>({...p})),
    outerBoundaryEdges:input.boundaries.map(edge=>({...edge})),
  };
}
