import type { ImportSummary,PartOrientation,PartPlacement,StockDefinition,WorkCoordinateSystem,ZLevelRoughingOperation } from './types';
import type { CanonicalToolpath } from './canonicalToolpath';
import { buildFaceTargetOperationState } from './faceTargetOperation';
import { buildModelRoughingOperationState } from './modelRoughingOperation';
export type ZLevelOperationState={mode:'face-target'|'model';toolpath:CanonicalToolpath|null;levelCount:number;errors:string[];warnings:string[];targetZ:number|null;roughBottomZ:number|null};
export function zLevelMode(operation:ZLevelRoughingOperation):'face-target'|'model'{return operation.roughingMode??'face-target'}
export function buildZLevelOperationState(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ZLevelRoughingOperation;}):ZLevelOperationState{
  const mode=zLevelMode(args.operation);if(mode==='model'){const s=buildModelRoughingOperationState(args);return{mode,toolpath:s.toolpath,levelCount:s.levelCount,errors:s.errors,warnings:s.warnings,targetZ:null,roughBottomZ:null}}
  if(!args.operation.faceIds.length)return{mode,toolpath:null,levelCount:0,errors:['Keine STEP/BRep-Zielfläche gewählt.'],warnings:[],targetZ:null,roughBottomZ:null};
  const s=buildFaceTargetOperationState(args);return s?{mode,toolpath:s.toolpath,levelCount:s.levelCount,errors:[],warnings:[],targetZ:s.targetZ,roughBottomZ:s.roughBottomZ}:{mode,toolpath:null,levelCount:0,errors:['Die gewählte STEP/BRep-Zielfläche ist für Face-Target Z-Level nicht rekonstruierbar.'],warnings:[],targetZ:null,roughBottomZ:null};
}
