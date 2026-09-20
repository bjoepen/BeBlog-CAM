import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { endMillRoughingSafetyAt } from './endMillRoughingSafety';

export type ThreeDRoughingEligibility='removable'|'protected'|'outside-target'|'unresolved';

export type ThreeDRoughingEligibilitySample={
  x:number;
  y:number;
  cutZ:number;
  safeZ:number|null;
  targetZ:number|null;
  state:ThreeDRoughingEligibility;
};

export type ThreeDRoughingLevelEligibility={
  valid:boolean;
  cutZ:number;
  samples:ThreeDRoughingEligibilitySample[];
  removableCount:number;
  protectedCount:number;
  outsideTargetCount:number;
  unresolvedCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;

/**
 * 008H-A4: sampled, fail-closed eligibility truth for one 3D roughing Z level.
 *
 * A Z level is only a query height. It never replaces CurvedFaceTarget or the
 * A3 cutter-footprint safety truth. Unresolved samples are never removable.
 * This function deliberately creates no regions, chains, toolpaths or motions.
 */
export function buildThreeDRoughingLevelEligibility(
  target:CurvedFaceTarget,
  partSafety:PartSafetySurface,
  cutZ:number,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  gridStepMm:number,
):ThreeDRoughingLevelEligibility{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!target.valid||!target.bounds)errors.push('Gekrümmte Zielfläche ist ungültig.');
  if(!Number.isFinite(cutZ))errors.push('Z-Level muss endlich sein.');
  if(!(cutterRadiusMm>0))errors.push('Fräserradius muss größer als 0 sein.');
  if(!(finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');
  if(!(gridStepMm>0))errors.push('Eligibility-Rasterabstand muss größer als 0 sein.');

  if(errors.length)return{
    valid:false,cutZ,samples:[],removableCount:0,protectedCount:0,outsideTargetCount:0,unresolvedCount:0,errors,warnings,
  };

  const b=target.bounds!;
  const nx=Math.max(1,Math.ceil((b.maxX-b.minX)/gridStepMm));
  const ny=Math.max(1,Math.ceil((b.maxY-b.minY)/gridStepMm));
  const samples:ThreeDRoughingEligibilitySample[]=[];
  let removableCount=0,protectedCount=0,outsideTargetCount=0,unresolvedCount=0;

  for(let iy=0;iy<=ny;iy++){
    const y=b.minY+(b.maxY-b.minY)*iy/ny;
    for(let ix=0;ix<=nx;ix++){
      const x=b.minX+(b.maxX-b.minX)*ix/nx;
      const safety=endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm);
      if(safety.status==='outside-target'){
        outsideTargetCount++;
        samples.push({x,y,cutZ,safeZ:null,targetZ:null,state:'outside-target'});
        continue;
      }
      if(!safety.valid||!safety.safety){
        unresolvedCount++;
        samples.push({x,y,cutZ,safeZ:null,targetZ:null,state:'unresolved'});
        continue;
      }

      if(cutZ+EPS>=safety.safety.safeZ){
        removableCount++;
        samples.push({x,y,cutZ,safeZ:safety.safety.safeZ,targetZ:safety.safety.targetZ,state:'removable'});
      }else{
        protectedCount++;
        samples.push({x,y,cutZ,safeZ:safety.safety.safeZ,targetZ:safety.safety.targetZ,state:'protected'});
      }
    }
  }

  const targetSamples=samples.filter(sample=>sample.targetZ!==null&&sample.safeZ!==null);
  if(targetSamples.length){
    const minTargetZ=Math.min(...targetSamples.map(sample=>sample.targetZ!));
    const maxTargetZ=Math.max(...targetSamples.map(sample=>sample.targetZ!));
    const minReachableZ=Math.min(...targetSamples.map(sample=>sample.safeZ!));
    const maxReachableZ=Math.max(...targetSamples.map(sample=>sample.safeZ!));
    warnings.push(`Reachability Z ${cutZ.toFixed(3)}: TARGET ${minTargetZ.toFixed(3)}…${maxTargetZ.toFixed(3)} · FLOOR ${minReachableZ.toFixed(3)}…${maxReachableZ.toFixed(3)}.`);
  }
  warnings.push(`Eligibility Z ${cutZ.toFixed(3)}: REMOVABLE ${removableCount} · PROTECTED ${protectedCount} · OUTSIDE_TARGET ${outsideTargetCount} · UNRESOLVED ${unresolvedCount}.`);
  if(unresolvedCount)warnings.push(`${unresolvedCount} Eligibility-Sample${unresolvedCount===1?' ist':'s sind'} fail-closed UNRESOLVED.`);

  return{
    valid:true,
    cutZ,
    samples,
    removableCount,
    protectedCount,
    outsideTargetCount,
    unresolvedCount,
    errors:[],
    warnings,
  };
}
