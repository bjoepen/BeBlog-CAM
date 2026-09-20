import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { PartSafetySurface } from './partSafetySurface';
import { flatEndCutterReachabilityAt } from './flatEndCutterReachability';
import type { ThreeDRoughingOperation } from './types';
import type { ThreeDRoughingZLevelSchedule } from './threeDRoughingZLevelSchedule';

export type ThreeDRoughingReachabilityLevelSchedule={
  valid:boolean;
  levels:number[];
  sampledReachabilityCount:number;
  addedReachabilityLevelCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;
const key=(z:number)=>Number(z.toFixed(7));
export const THREE_D_ROUGHING_REACHABILITY_LEVEL_FRACTION=.125;

function conservativeLevelAtOrAbove(floor:number,topZ:number,quantumMm:number):number{
  // Quantization is always upward (towards stock top). It can therefore only
  // make a candidate more conservative than the sampled A16 reachable floor.
  const depth=Math.max(0,topZ-floor);
  return topZ-Math.floor((depth+EPS)/quantumMm)*quantumMm;
}

/**
 * 008H-A17: candidate-height proposal only.
 *
 * A8 remains the stock/target base schedule. A16 may propose additional
 * constant-Z candidate heights where a flat end mill can safely begin removing
 * stock. A17 never marks XY material removable: every returned height must
 * still pass A4 -> A5 -> A6.
 *
 * Reachability may propose a Z level; it never approves a cut.
 */
export function buildThreeDRoughingReachabilityLevelSchedule(args:{
  target:CurvedFaceTarget;
  partSafety:PartSafetySurface;
  baseSchedule:ThreeDRoughingZLevelSchedule;
  operation:ThreeDRoughingOperation;
  gridStepMm:number;
}):ThreeDRoughingReachabilityLevelSchedule{
  const {target,partSafety,baseSchedule,operation,gridStepMm}=args;
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!baseSchedule.valid)errors.push('A8 3D-Schrupp-Basis-Schedule ist ungültig.');
  if(!target.valid||!target.bounds)errors.push('Gekrümmte Zielfläche ist ungültig.');
  if(!partSafety.valid||!partSafety.bounds)errors.push('Part Safety Truth ist ungültig.');
  if(operation.tool.kind!=='end-mill'||!(operation.tool.diameterMm>0))errors.push('A17 benötigt einen gültigen Schaftfräser.');
  if(!(operation.stepDownMm>0))errors.push('Zustelltiefe muss größer als 0 sein.');
  if(!(operation.finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');
  if(!(gridStepMm>0&&Number.isFinite(gridStepMm)))errors.push('A17 Reachability-Rasterabstand ist ungültig.');

  if(errors.length)return{valid:false,levels:[],sampledReachabilityCount:0,addedReachabilityLevelCount:0,errors:[...new Set(errors)],warnings};

  const topZ=baseSchedule.topZ;
  const bottomZ=baseSchedule.bottomZ;
  if(bottomZ>=topZ-EPS)return{valid:true,levels:[],sampledReachabilityCount:0,addedReachabilityLevelCount:0,errors:[],warnings};

  const b=target.bounds!;
  const nx=Math.max(1,Math.ceil((b.maxX-b.minX)/gridStepMm));
  const ny=Math.max(1,Math.ceil((b.maxY-b.minY)/gridStepMm));
  const reachableFloors:number[]=[];
  let sampledReachabilityCount=0;

  for(let iy=0;iy<=ny;iy++){
    const y=b.minY+(b.maxY-b.minY)*iy/ny;
    for(let ix=0;ix<=nx;ix++){
      const x=b.minX+(b.maxX-b.minX)*ix/nx;
      const reach=flatEndCutterReachabilityAt(
        target,partSafety,x,y,operation.tool.diameterMm/2,operation.finishAllowanceMm,
      );
      if(reach.status==='unresolved'){
        errors.push(reach.error??'A17 Reachability-Sample ist ungeklärt.');
        continue;
      }
      if(reach.status!=='reachable'||reach.reachableFloorZ===null)continue;
      sampledReachabilityCount++;
      // Above stock top means there is no roughing cut in stock at this XY.
      if(reach.reachableFloorZ>topZ+EPS)continue;
      // Below the A8 lower boundary cannot enlarge the approved roughing depth.
      reachableFloors.push(Math.max(bottomZ,reach.reachableFloorZ));
    }
  }

  if(errors.length)return{valid:false,levels:[],sampledReachabilityCount,addedReachabilityLevelCount:0,errors:[...new Set(errors)],warnings};

  const candidates=new Set<number>(baseSchedule.levels.map(key));
  const baseKeys=new Set(candidates);
  const quantumMm=Math.max(.01,operation.stepDownMm*THREE_D_ROUGHING_REACHABILITY_LEVEL_FRACTION);

  // A18 consolidates the potentially dense continuum of A16 floors onto a
  // deterministic vertical lattice. Quantization is conservative: a floor is
  // rounded UP only, never down into protected material. A4/A6 still prove
  // every resulting constant-Z candidate before manufacturing.
  for(const floor of reachableFloors){
    if(floor>=topZ-EPS)continue;
    const consolidatedFloor=Math.max(bottomZ,conservativeLevelAtOrAbove(floor,topZ,quantumMm));
    let z=topZ;
    while(z-operation.stepDownMm>consolidatedFloor+EPS){
      z-=operation.stepDownMm;
      candidates.add(key(z));
    }
    if(consolidatedFloor<topZ-EPS)candidates.add(key(consolidatedFloor));
  }

  const levels=[...candidates]
    .filter(z=>z<topZ-EPS&&z>=bottomZ-EPS)
    .sort((a,b)=>b-a);

  const addedReachabilityLevelCount=levels.filter(z=>!baseKeys.has(z)).length;
  if(addedReachabilityLevelCount)warnings.push(
    `A18: ${addedReachabilityLevelCount} konsolidierte konstante Reachability-Z-Level vorgeschlagen (Raster ${quantumMm.toFixed(3)} mm); jeder Level bleibt A4/A5/A6-prüfpflichtig.`,
  );

  return{valid:true,levels,sampledReachabilityCount,addedReachabilityLevelCount,errors:[],warnings};
}
