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
import type { ZLevelPerformanceProfile } from './zLevelPerformance';

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
  profile?:ZLevelPerformanceProfile;
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
      warnings:planar.islandLoopCount?[
        planar.islandMode==='clear'
          ?`004Z-B: ${planar.islandLoopCount} Inneninsel${planar.islandLoopCount===1?'':'n'} wird/werden bis zur Zielfläche mit geschruppt.`
          :`004Z-B: ${planar.islandLoopCount} Inneninsel${planar.islandLoopCount===1?'':'n'} bleibt/bleiben beim Flächenschruppen stehen.`
      ]:[],
      targetZ:planar.targetZ,
      roughBottomZ:planar.roughBottomZ,
      targetMinZ:planar.targetZ,
      targetMaxZ:planar.targetZ,
    };
  }

  // 008H: non-planar face targets use the same solid-slice truth as model
  // roughing. Selected faces define scope only; the complete STEP solid defines
  // material, cutter clearance and top accessibility.
  const solid=buildModelRoughingOperationState({...args,scopeToSelectedFaces:true});
  return{
    mode,
    targetKind:'curved-face',
    toolpath:solid.toolpath,
    levelCount:solid.levelCount,
    errors:solid.errors,
    warnings:solid.warnings,
    targetZ:null,
    roughBottomZ:null,
    targetMinZ:null,
    targetMaxZ:null,
  };
}
}
