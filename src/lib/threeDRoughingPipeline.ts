import type { CanonicalToolpath } from './canonicalToolpath';
import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { buildThreeDRoughingZLevelSchedule } from './threeDRoughingZLevelSchedule';
import { buildThreeDRoughingLevelEligibility } from './threeDRoughingLevelEligibility';
import { buildThreeDRoughingReachabilityLevelSchedule } from './threeDRoughingReachabilityLevelSchedule';
import { buildThreeDRoughingMaterialConnectivity } from './threeDRoughingMaterialConnectivity';
import { buildThreeDRoughingSafeChains } from './threeDRoughingSafeChains';
import { buildThreeDRoughingCanonicalSafeEdges, type ThreeDRoughingCanonicalResult } from './threeDRoughingCanonicalSafeEdges';
import { assembleThreeDRoughingCanonicalLevels } from './threeDRoughingMultiLevelCanonical';
import type { StockDefinition, ThreeDRoughingOperation, WorkCoordinateSystem } from './types';

export type ThreeDRoughingPipelineResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  scheduledLevelCount:number;
  cuttingLevelCount:number;
  skippedEmptyLevelCount:number;
  runCount:number;
  eligibilityGridStepMm:number;
  segmentValidationStepMm:number;
  errors:string[];
  warnings:string[];
};

export const THREE_D_ROUGHING_SEGMENT_VALIDATION_STEP_MM=.25;

export function threeDRoughingEligibilityGridStepMm(operation:ThreeDRoughingOperation):number{
  return operation.tool.diameterMm*operation.stepoverPercent/100;
}

/**
 * 008H-A10: orchestration only.
 *
 * A10 wires existing A8 -> A4 -> A5 -> A6 -> A7 -> A9 contracts. It creates
 * no new geometric or safety truth. No proven cut is not an error; unproven
 * safety is. Production dispatch remains locked until a later release stage.
 */
export function buildThreeDRoughingPipeline(args:{
  target:CurvedFaceTarget;
  partSafety:PartSafetySurface;
  stock:StockDefinition;
  wcs:WorkCoordinateSystem;
  operation:ThreeDRoughingOperation;
}):ThreeDRoughingPipelineResult{
  const {target,partSafety,stock,wcs,operation}=args;
  const errors:string[]=[];
  const warnings:string[]=[];
  const eligibilityGridStepMm=threeDRoughingEligibilityGridStepMm(operation);
  const segmentValidationStepMm=THREE_D_ROUGHING_SEGMENT_VALIDATION_STEP_MM;

  if(!(eligibilityGridStepMm>0&&Number.isFinite(eligibilityGridStepMm))){
    errors.push('3D-Schrupp-Eligibility-Rasterabstand ist ungültig.');
  }

  const schedule=buildThreeDRoughingZLevelSchedule({target,stock,wcs,operation});
  errors.push(...schedule.errors);
  warnings.push(...schedule.warnings);

  if(errors.length)return{
    ok:false,toolpath:null,scheduledLevelCount:reachabilitySchedule.levels.length,cuttingLevelCount:0,
    skippedEmptyLevelCount:0,runCount:0,eligibilityGridStepMm,segmentValidationStepMm,
    errors:[...new Set(errors)],warnings:[...new Set(warnings)],
  };

  const reachabilitySchedule=buildThreeDRoughingReachabilityLevelSchedule({
    target,partSafety,baseSchedule:schedule,operation,gridStepMm:eligibilityGridStepMm,
  });
  errors.push(...reachabilitySchedule.errors);
  warnings.push(...reachabilitySchedule.warnings);
  if(errors.length)return{
    ok:false,toolpath:null,scheduledLevelCount:reachabilitySchedule.levels.length,cuttingLevelCount:0,
    skippedEmptyLevelCount:0,runCount:0,eligibilityGridStepMm,segmentValidationStepMm,
    errors:[...new Set(errors)],warnings:[...new Set(warnings)],
  };

  const canonicalLevels:ThreeDRoughingCanonicalResult[]=[];
  let skippedEmptyLevelCount=0;

  for(const cutZ of reachabilitySchedule.levels){
    const eligibility=buildThreeDRoughingLevelEligibility(
      target,partSafety,cutZ,operation.tool.diameterMm/2,operation.finishAllowanceMm,eligibilityGridStepMm,
    );
    warnings.push(...eligibility.warnings);
    if(!eligibility.valid){
      errors.push(...eligibility.errors.map(error=>`Z ${cutZ.toFixed(3)}: ${error}`));
      continue;
    }

    const connectivity=buildThreeDRoughingMaterialConnectivity(eligibility);
    warnings.push(...connectivity.warnings);
    if(!connectivity.valid){
      errors.push(...connectivity.errors.map(error=>`Z ${cutZ.toFixed(3)}: ${error}`));
      continue;
    }

    const safe=buildThreeDRoughingSafeChains(
      target,partSafety,connectivity,operation.tool.diameterMm/2,operation.finishAllowanceMm,segmentValidationStepMm,operation.direction??'x',
    );
    warnings.push(...safe.warnings);
    if(!safe.valid){
      errors.push(...safe.errors.map(error=>`Z ${cutZ.toFixed(3)}: ${error}`));
      continue;
    }

    // A valid level with no proven safe edge is intentionally empty. It does
    // not call A7, because A7 correctly rejects an empty manufacturing level.
    if(!safe.chains.length){
      skippedEmptyLevelCount++;
      continue;
    }

    const canonical=buildThreeDRoughingCanonicalSafeEdges(safe,operation);
    warnings.push(...canonical.warnings);
    if(!canonical.ok||!canonical.toolpath){
      errors.push(...canonical.errors.map(error=>`Z ${cutZ.toFixed(3)}: ${error}`));
      continue;
    }
    canonicalLevels.push(canonical);
  }

  if(errors.length)return{
    ok:false,toolpath:null,scheduledLevelCount:reachabilitySchedule.levels.length,cuttingLevelCount:canonicalLevels.length,
    skippedEmptyLevelCount,runCount:0,eligibilityGridStepMm,segmentValidationStepMm,
    errors:[...new Set(errors)],warnings:[...new Set(warnings)],
  };

  if(!canonicalLevels.length)return{
    ok:true,toolpath:null,scheduledLevelCount:reachabilitySchedule.levels.length,cuttingLevelCount:0,
    skippedEmptyLevelCount,runCount:0,eligibilityGridStepMm,segmentValidationStepMm,
    errors:[],warnings:[...new Set([...warnings,'3D Schruppen: Kein bewiesener Schnitt auf den geplanten Z-Leveln.'])],
  };

  const assembled=assembleThreeDRoughingCanonicalLevels(canonicalLevels,operation);
  warnings.push(...assembled.warnings);
  if(!assembled.ok||!assembled.toolpath)return{
    ok:false,toolpath:null,scheduledLevelCount:reachabilitySchedule.levels.length,cuttingLevelCount:canonicalLevels.length,
    skippedEmptyLevelCount,runCount:0,eligibilityGridStepMm,segmentValidationStepMm,
    errors:[...new Set(assembled.errors)],warnings:[...new Set(warnings)],
  };

  return{
    ok:true,toolpath:assembled.toolpath,scheduledLevelCount:reachabilitySchedule.levels.length,
    cuttingLevelCount:canonicalLevels.length,skippedEmptyLevelCount,runCount:assembled.runCount,
    eligibilityGridStepMm,segmentValidationStepMm,errors:[],warnings:[...new Set(warnings)],
  };
}
