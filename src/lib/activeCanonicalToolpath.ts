import type { CanonicalToolpath } from './canonicalToolpath';
import { buildFacingToolpath } from './facingToolpath';
import { buildDxfContourCanonicalState } from './gcode';
import { buildStepContourOperationState } from './stepContourOperation';
import { buildPocketOperationState } from './pocketOperationState';
import { buildCarveCanonicalToolpath } from './carveCanonicalToolpath';
import { buildDrillCanonicalToolpath } from './drillCanonicalToolpath';
import { buildStepDrillOperationState } from './stepDrillOperation';
import { buildZLevelOperationState } from './zLevelOperationState';
import { buildSurfaceFinishingOperationState } from './surfaceFinishingOperation';
import { buildDxfMultiTargetContourState, buildDxfMultiTargetPocketState } from './dxfMultiTargetToolpath';
import type { CamOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { createZLevelPerformanceProfile, type ZLevelPerformanceProfile } from './zLevelPerformance';

export function buildActiveCanonicalToolpath(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:CamOperation;previousToolpaths?:CanonicalToolpath[];zLevelPerformanceProfile?:ZLevelPerformanceProfile;}):CanonicalToolpath|null{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;
  if(operation.kind==='facing'){
    if(stockMode==='none')return null;
    return buildFacingToolpath({stock,wcs,operation}).toolpath;
  }
  if(operation.kind==='contour'){
    if(summary.kind==='step'){
      const state=buildStepContourOperationState({summary,stock,stockMode,placement,orientation,wcs,operation,previousToolpaths:args.previousToolpaths});
      return state.ok?state.toolpath:null;
    }
    const state=buildDxfMultiTargetContourState({summary,stock,stockMode,placement,orientation,wcs,operation});
    return state.ok?state.toolpath:null;
  }
  if(operation.kind==='pocket'){
    const state=summary.kind==='dxf'?buildDxfMultiTargetPocketState({summary,stock,stockMode,placement,orientation,wcs,operation,previousToolpaths:args.previousToolpaths}):buildPocketOperationState({summary,stock,stockMode,placement,orientation,wcs,operation,previousToolpaths:args.previousToolpaths});
    return state.ok?state.toolpath:null;
  }
  if(operation.kind==='carve')return buildCarveCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
  if(operation.kind==='drill'){
    if(summary.kind==='step'){
      const state=buildStepDrillOperationState({summary,stock,stockMode,placement,orientation,wcs,operation,previousToolpaths:args.previousToolpaths});
      return state.ok?state.toolpath:null;
    }
    return buildDrillCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
  }
  if(operation.kind==='3d-roughing'){
    // 008H-A1 establishes the operation boundary only. No manufacturing
    // toolpath is emitted until the dedicated 3D roughing kernel is accepted.
    return null;
  }
  if(operation.kind==='surface-finishing'){
    const state=buildSurfaceFinishingOperationState({summary,stock,placement,orientation,wcs,operation});
    return state.ok?state.toolpath:null;
  }
  const profile=args.zLevelPerformanceProfile;
  const state=buildZLevelOperationState({summary,stock,placement,orientation,wcs,operation,profile});
  return state.errors.length===0?state.toolpath:null;
}

/** 008E development helper: runs the exact production path with opt-in counters. */
export function buildActiveCanonicalToolpathProfiled(args:Omit<Parameters<typeof buildActiveCanonicalToolpath>[0],'zLevelPerformanceProfile'>){
  const profile=createZLevelPerformanceProfile();
  const toolpath=buildActiveCanonicalToolpath({...args,zLevelPerformanceProfile:profile});
  return{toolpath,profile};
}
