import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
  WorkCoordinateSystem,
  ZLevelRoughingOperation,
} from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import { buildFaceTargetOperationState } from './faceTargetOperation';
import { buildModelRoughingOperationState } from './modelRoughingOperation';
import { buildCurvedFaceRoughingOperationState } from './curvedFaceRoughingOperation';

export type ZLevelTargetKind='planar-face'|'curved-face'|'model';

export type ZLevelOperationState={
  mode:'face-target'|'model';
  targetKind:ZLevelTargetKind;
  toolpath:CanonicalToolpath|null;
  levelCount:number;
  errors:string[];
  warnings:string[];
  targetZ:number|null;
  roughBottomZ:number|null;
  targetMinZ:number|null;
  targetMaxZ:number|null;
};

export function zLevelMode(operation:ZLevelRoughingOperation):'face-target'|'model'{
  return operation.roughingMode??'face-target';
}

export function buildZLevelOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:ZLevelRoughingOperation;
}):ZLevelOperationState{
  const mode=zLevelMode(args.operation);

  if(mode==='model'){
    const state=buildModelRoughingOperationState(args);
    return{
      mode,
      targetKind:'model',
      toolpath:state.toolpath,
      levelCount:state.levelCount,
      errors:state.errors,
      warnings:state.warnings,
      targetZ:null,
      roughBottomZ:null,
      targetMinZ:null,
      targetMaxZ:null,
    };
  }

  if(!args.operation.faceIds.length){
    return{
      mode,
      targetKind:'planar-face',
      toolpath:null,
      levelCount:0,
      errors:['Keine STEP/BRep-Zielfläche gewählt.'],
      warnings:[],
      targetZ:null,
      roughBottomZ:null,
      targetMinZ:null,
      targetMaxZ:null,
    };
  }

  const planar=buildFaceTargetOperationState(args);
  if(planar){
    return{
      mode,
      targetKind:'planar-face',
      toolpath:planar.toolpath,
      levelCount:planar.levelCount,
      errors:[],
      warnings:[],
      targetZ:planar.targetZ,
      roughBottomZ:planar.roughBottomZ,
      targetMinZ:planar.targetZ,
      targetMaxZ:planar.targetZ,
    };
  }

  const curved=buildCurvedFaceRoughingOperationState(args);
  if(curved.ok&&curved.toolpath){
    return{
      mode,
      targetKind:'curved-face',
      toolpath:curved.toolpath,
      levelCount:curved.levelCount,
      errors:[],
      warnings:curved.warnings,
      targetZ:null,
      roughBottomZ:null,
      targetMinZ:curved.targetMinZ,
      targetMaxZ:curved.targetMaxZ,
    };
  }

  return{
    mode,
    targetKind:'curved-face',
    toolpath:null,
    levelCount:curved.levelCount,
    errors:curved.errors.length
      ?curved.errors
      :['Die gewählte STEP/BRep-Zielfläche ist weder als planares noch als gekrümmtes Face Target rekonstruierbar.'],
    warnings:curved.warnings,
    targetZ:null,
    roughBottomZ:null,
    targetMinZ:curved.targetMinZ,
    targetMaxZ:curved.targetMaxZ,
  };
}
