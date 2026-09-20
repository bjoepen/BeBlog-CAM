import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { flatEndCutterReachabilityAt } from './flatEndCutterReachability';

export type EndMillRoughingSafetyPoint={
  x:number;
  y:number;
  safeZ:number;
  surfaceMaxZ:number;
  targetZ:number;
  finishAllowanceMm:number;
};

export type EndMillRoughingSafetyStatus='safe'|'outside-target'|'unresolved';

export type EndMillRoughingSafetyResult={
  valid:boolean;
  status:EndMillRoughingSafetyStatus;
  safety:EndMillRoughingSafetyPoint|null;
  error:string|null;
};

/**
 * A3 safety adapter over the explicit A16 flat-end reachability truth.
 * safeZ is the lowest legal flat-end tool-bottom Z. It is not target Z and
 * must not be bypassed or clamped downward by later stages.
 */
export function endMillRoughingSafetyAt(
  target:CurvedFaceTarget,
  partSafety:PartSafetySurface,
  x:number,
  y:number,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  sampleStepMm=.25,
):EndMillRoughingSafetyResult{
  const reachability=flatEndCutterReachabilityAt(
    target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm,sampleStepMm,
  );
  if(reachability.status==='outside-target')return{valid:false,status:'outside-target',safety:null,error:null};
  if(reachability.status==='unresolved'||reachability.targetZ===null||reachability.reachableFloorZ===null){
    return{valid:false,status:'unresolved',safety:null,error:reachability.error??'Flat-End-Reachability ist ungeklärt.'};
  }

  return{
    valid:true,
    status:'safe',
    safety:{
      x,y,
      safeZ:reachability.reachableFloorZ,
      surfaceMaxZ:reachability.footprintPartMaxZ??reachability.targetZ,
      targetZ:reachability.targetZ,
      finishAllowanceMm,
    },
    error:null,
  };
}
