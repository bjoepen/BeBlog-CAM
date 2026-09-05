import { postPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { buildStepPocketOperationState } from './stepPocketOperation';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type StepPocketGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;};
export function generateStepPocketGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation;}):StepPocketGcodeResult{
  const state=buildStepPocketOperationState(args);if(!state.ok||!state.toolpath)return{ok:false,errors:state.errors,warnings:state.warnings,code:'',lineCount:0};
  try{const code=postPocketCanonicalToolpath(state.toolpath,{safeZMm:args.operation.safeZMm,feedMmMin:args.operation.feedMmMin,plungeMmMin:args.operation.plungeMmMin,spindleRpm:args.operation.spindleRpm});return{ok:true,errors:[],warnings:state.warnings,code,lineCount:code.trimEnd().split(/\r?\n/).length};}
  catch(error){return{ok:false,errors:[String(error)],warnings:state.warnings,code:'',lineCount:0};}
}
