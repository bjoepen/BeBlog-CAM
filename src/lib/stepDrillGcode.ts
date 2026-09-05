import { postDrillCanonicalToolpath } from './drillCanonicalToolpath';
import { buildStepDrillOperationState } from './stepDrillOperation';
import type { DrillOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type StepDrillGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;holeCount:number};

export function generateStepDrillGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation;}):StepDrillGcodeResult{
  const state=buildStepDrillOperationState(args);
  if(!state.ok||!state.toolpath)return{ok:false,errors:state.errors,warnings:state.warnings,code:'',lineCount:0,holeCount:state.holes.length};
  try{
    const code=postDrillCanonicalToolpath(state.toolpath,{spindleRpm:args.operation.spindleRpm});
    return{ok:true,errors:[],warnings:state.warnings,code,lineCount:code.trimEnd().split(/\r?\n/).length,holeCount:state.holes.length};
  }catch(error){
    return{ok:false,errors:[String(error)],warnings:state.warnings,code:'',lineCount:0,holeCount:state.holes.length};
  }
}
