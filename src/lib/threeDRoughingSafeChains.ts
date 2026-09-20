import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
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
  partSafety:PartSafetySurface,
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
    const safety=endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm);
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
  partSafety:PartSafetySurface,
  connectivity:ThreeDRoughingMaterialConnectivity,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  validationStepMm:number,
  direction:'x'|'y'='x',
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

  // A6 is not a path-ordering strategy. It proves only immediate orthogonal
  // A5 grid edges and exposes each accepted edge as a minimal safe chain.
  for(const component of connectivity.components){
    const xs=[...new Set(component.samples.map(sample=>sample.x))].sort((a,b)=>a-b);
    const ys=[...new Set(component.samples.map(sample=>sample.y))].sort((a,b)=>a-b);
    const byKey=new Map(component.samples.map(sample=>[`${sample.x.toPrecision(15)}|${sample.y.toPrecision(15)}`,sample]));

    for(const sample of component.samples){
      const ix=xs.findIndex(x=>Math.abs(x-sample.x)<=EPS);
      const iy=ys.findIndex(y=>Math.abs(y-sample.y)<=EPS);
      const candidates=direction==='x'
        ?[ix+1<xs.length?byKey.get(`${xs[ix+1].toPrecision(15)}|${sample.y.toPrecision(15)}`):undefined]
        :[iy+1<ys.length?byKey.get(`${sample.x.toPrecision(15)}|${ys[iy+1].toPrecision(15)}`):undefined];

      for(const next of candidates){
        if(!next)continue;
        if(segmentIsSafe(target,partSafety,sample,next,cutterRadiusMm,finishAllowanceMm,validationStepMm)){
          chains.push({componentId:component.id,cutZ:component.cutZ,samples:[sample,next]});
        }else{
          rejectedSegmentCount++;
        }
      }
    }
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
