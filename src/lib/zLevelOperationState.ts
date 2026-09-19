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

  // 004Z invariant: if the selected face is planar, a failed planar Face
  // Target must stay planar. It must never masquerade as a curved target.
  // 008H only replaces the genuinely non-planar path below.
  const curved=buildCurvedFaceRoughingOperationState(args);
  const planarFallback=curved.errors.includes('Die Zielfläche ist planar und gehört zum planaren Face-Target-Pfad.');
  if(planarFallback){
    const targetZ=curved.targetMaxZ;
    const atStockTop=targetZ!=null&&Math.abs(targetZ-args.stock.thickness)<=1e-4;
    return{
      mode,
      targetKind:'planar-face',
      toolpath:null,
      levelCount:0,
      errors:[atStockTop
        ?'Die gewählte obere STEP-Fläche liegt auf Rohlingoberkante. Face Target hat dort keinen vertikalen Abtrag; zum Freiräumen des Materials um das Modell „Stock – Model“ verwenden.'
        :'Die gewählte STEP-Fläche ist planar, konnte aber nicht als zusammenhängendes planares Face Target rekonstruiert werden.'],
      warnings:curved.warnings,
      targetZ,
      roughBottomZ:null,
      targetMinZ:curved.targetMinZ,
      targetMaxZ:curved.targetMaxZ,
    };
  }

  // 008H-N3 hard boundary: curved Face targets are asynchronous native OCCT
  // geometry. This synchronous reconstruction API must never fall back to the
  // rejected 008H-M TypeScript ownership heuristic. App/preflight inject the
  // cached native canonical truth; every other caller fails closed.
  return{
    mode,
    targetKind:'curved-face',
    toolpath:null,
    levelCount:0,
    errors:['008H-N3: Gekrümmtes Face Target benötigt die autoritative native OCCT-Materialregion. Kein TypeScript-Ownership-Fallback zulässig.'],
    warnings:[],
    targetZ:null,
    roughBottomZ:null,
    targetMinZ:curved.targetMinZ,
    targetMaxZ:curved.targetMaxZ,
  };
}
