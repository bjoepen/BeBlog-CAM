import type { CurvedFaceTarget } from './curvedFaceTarget';
import { curvedFaceTargetZAt } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { partSafetyUpperZAt } from './partSafetySurface';

export type FlatEndReachabilityStatus='reachable'|'outside-target'|'unresolved';

export type FlatEndReachability={
  status:FlatEndReachabilityStatus;
  targetZ:number|null;
  reachableFloorZ:number|null;
  footprintPartMaxZ:number|null;
  finishAllowanceMm:number;
  error:string|null;
};

const EPS=1e-7;

/**
 * 008H-A16: cutter-geometry truth for a flat end mill in 3-axis top machining.
 *
 * Target Z is machining intent. Part upper-envelope Z is finished-part
 * protection. reachableFloorZ is the lowest legal tool-bottom Z at this XY for
 * this cutter footprint. It is deliberately NOT a toolpath and does not turn an
 * unreachable scheduled level into a lower/unsafe cut.
 */
export function flatEndCutterReachabilityAt(
  target:CurvedFaceTarget,
  partSafety:PartSafetySurface,
  x:number,
  y:number,
  cutterRadiusMm:number,
  finishAllowanceMm:number,
  sampleStepMm=.25,
):FlatEndReachability{
  if(!target.valid||!target.bounds)return{status:'unresolved',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:'Gekrümmte Zielfläche ist ungültig.'};
  if(!partSafety.valid||!partSafety.bounds)return{status:'unresolved',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:'Part Safety Truth ist ungültig.'};
  if(!(cutterRadiusMm>0))return{status:'unresolved',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:'Fräserradius muss größer als 0 sein.'};
  if(!(finishAllowanceMm>=0))return{status:'unresolved',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:'Schlichtaufmaß darf nicht negativ sein.'};
  if(!(sampleStepMm>0))return{status:'unresolved',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:'Abtastschritt muss größer als 0 sein.'};

  const targetZ=curvedFaceTargetZAt(target,x,y);
  if(targetZ===null)return{status:'outside-target',targetZ:null,reachableFloorZ:null,footprintPartMaxZ:null,finishAllowanceMm,error:null};

  const step=Math.min(sampleStepMm,Math.max(.05,cutterRadiusMm/8));
  const samples=Math.max(1,Math.ceil((cutterRadiusMm*2)/step));
  let footprintPartMaxZ:number|null=null;

  for(let iy=0;iy<=samples;iy++){
    const dy=-cutterRadiusMm+(2*cutterRadiusMm*iy)/samples;
    for(let ix=0;ix<=samples;ix++){
      const dx=-cutterRadiusMm+(2*cutterRadiusMm*ix)/samples;
      if(dx*dx+dy*dy>cutterRadiusMm*cutterRadiusMm+EPS)continue;
      const partZ=partSafetyUpperZAt(partSafety,x+dx,y+dy);
      if(partZ!==null&&(footprintPartMaxZ===null||partZ>footprintPartMaxZ))footprintPartMaxZ=partZ;
    }
  }

  // The target centre itself is protected even if display triangulation causes
  // the complete-part envelope to miss the exact boundary sample.
  const protectedMaxZ=Math.max(targetZ,footprintPartMaxZ??targetZ);
  const reachableFloorZ=protectedMaxZ+finishAllowanceMm;
  if(!Number.isFinite(reachableFloorZ))return{status:'unresolved',targetZ,reachableFloorZ:null,footprintPartMaxZ,finishAllowanceMm,error:'Für die Fräser-Stirnfläche konnte keine erreichbare Mindesthöhe bestimmt werden.'};

  return{status:'reachable',targetZ,reachableFloorZ,footprintPartMaxZ,finishAllowanceMm,error:null};
}
