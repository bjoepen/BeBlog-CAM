import type { CurvedFaceTarget } from './curvedFaceTarget';
import { endMillRoughingSafetyAt } from './endMillRoughingSafety';
import type {
  ThreeDRoughingEligibilitySample,
} from './threeDRoughingLevelEligibility';
import type {
  ThreeDRoughingMaterialConnectivity,
} from './threeDRoughingMaterialConnectivity';

export type ThreeDRoughingSafeChain={
  componentId:number;
  cutZ:number;
  samples:ThreeDRoughingEligibilitySample[];
};

export type ThreeDRoughingSafeChains={
  valid:boolean;
  cutZ:number;
  chains:ThreeDRoughingSafeChain[];
  rejectedSegmentCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;

function segmentIsSafe(
  target:CurvedFaceTarget,
  from:ThreeDRoughingEligibilitySample,
  to:ThreeDRoughingEligibilitySample,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  validationStepMm:number,
):boolean{
  if(from.state!=='removable'||to.state!=='removable')return false;
  if(Math.abs(from.cutZ-to.cutZ)>EPS)return false;

  const dx=to.x-from.x,dy=to.y-from.y;
  const distance=Math.hypot(dx,dy);
  if(!(distance>EPS))return false;

  // A6 deliberately permits only orthogonal A5-neighbour transitions.
  if(Math.abs(dx)>EPS&&Math.abs(dy)>EPS)return false;

  const steps=Math.max(1,Math.ceil(distance/validationStepMm));
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const x=from.x+dx*t,y=from.y+dy*t;
    const safety=endMillRoughingSafetyAt(target,x,y,cutterRadiusMm,finishAllowanceMm);
    if(!safety.valid||!safety.safety||from.cutZ+EPS<safety.safety.safeZ)return false;
  }
  return true;
}

/**
 * 008H-A6: fail-closed safe roughing chains on one constant Z level.
 *
 * A5 connectivity is only a candidate graph. Every accepted edge is re-proven
 * continuously by deterministic intermediate A3 cutter-footprint samples.
 * This stage creates no CanonicalToolpath, rapid/retract/plunge/stay-down
 * motion and no NC output.
 */
export function buildThreeDRoughingSafeChains(
  target:CurvedFaceTarget,
  connectivity:ThreeDRoughingMaterialConnectivity,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  validationStepMm:number,
):ThreeDRoughingSafeChains{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!target.valid||!target.bounds)errors.push('Gekrümmte Zielfläche ist ungültig.');
  if(!connectivity.valid)errors.push('3D-Schrupp-Material-Connectivity ist ungültig.');
  if(!(cutterRadiusMm>0))errors.push('Fräserradius muss größer als 0 sein.');
  if(!(finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');
  if(!(validationStepMm>0))errors.push('Segment-Prüfschritt muss größer als 0 sein.');

  if(errors.length)return{
    valid:false,cutZ:connectivity.cutZ,chains:[],rejectedSegmentCount:0,errors,warnings,
  };

  const chains:ThreeDRoughingSafeChain[]=[];
  let rejectedSegmentCount=0;

  for(const component of connectivity.components){
    const samples=[...component.samples].sort((a,b)=>a.y-b.y||a.x-b.x);
    if(samples.length<2)continue;

    let current:ThreeDRoughingEligibilitySample[]=[samples[0]];
    for(let i=1;i<samples.length;i++){
      const previous=current[current.length-1];
      const next=samples[i];
      if(segmentIsSafe(target,previous,next,cutterRadiusMm,finishAllowanceMm,validationStepMm)){
        current.push(next);
        continue;
      }

      rejectedSegmentCount++;
      if(current.length>=2)chains.push({componentId:component.id,cutZ:component.cutZ,samples:current});
      current=[next];
    }
    if(current.length>=2)chains.push({componentId:component.id,cutZ:component.cutZ,samples:current});
  }

  if(rejectedSegmentCount)warnings.push(`${rejectedSegmentCount} Kandidaten-Segment${rejectedSegmentCount===1?' wurde':'e wurden'} fail-closed verworfen.`);

  return{
    valid:true,
    cutZ:connectivity.cutZ,
    chains,
    rejectedSegmentCount,
    errors:[],
    warnings,
  };
}
