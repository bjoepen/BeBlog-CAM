import type { CurvedFaceTarget } from './curvedFaceTarget';
import type { StockDefinition, ThreeDRoughingOperation, WorkCoordinateSystem } from './types';

export type ThreeDRoughingZLevelSchedule={
  valid:boolean;
  topZ:number;
  bottomZ:number;
  levels:number[];
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;

/**
 * 008H-A8: deterministic Z-only schedule for 3D roughing.
 *
 * Stock Truth owns the upper material boundary. CurvedFaceTarget plus the
 * approved finish allowance owns the conservative lower scheduling boundary.
 * A8 decides only WHICH Z heights are queried. It creates no XY eligibility,
 * connectivity, safe edges, canonical runs, machine motions or NC output.
 */
export function buildThreeDRoughingZLevelSchedule(args:{
  target:CurvedFaceTarget;
  stock:StockDefinition;
  wcs:WorkCoordinateSystem;
  operation:ThreeDRoughingOperation;
}):ThreeDRoughingZLevelSchedule{
  const {target,stock,wcs,operation}=args;
  const errors:string[]=[];
  const warnings:string[]=[];

  if(wcs.z!=='top')errors.push('3D Schruppen benötigt WCS Z auf der Rohlingoberseite.');
  if(!target.valid||!target.bounds)errors.push('Gekrümmte Zielfläche ist ungültig.');
  if(!(stock.thickness>0))errors.push('Rohlingdicke muss größer als 0 sein.');
  if(!(operation.stepDownMm>0))errors.push('Zustelltiefe muss größer als 0 sein.');
  if(!(operation.finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');

  // With WCS Z=top, stock material occupies Z <= 0. offsetZ belongs to the
  // placed part, not to the stock top datum. Never derive topZ from target.maxZ.
  const topZ=0;
  const bottomZ=target.bounds?Math.max(-stock.thickness,target.bounds.minZ+operation.finishAllowanceMm):Number.NaN;

  if(Number.isFinite(bottomZ)&&bottomZ>topZ+EPS){
    errors.push('Untere 3D-Schrupp-Scheduling-Grenze liegt oberhalb der Rohlingoberseite.');
  }

  if(errors.length)return{valid:false,topZ,bottomZ,levels:[],errors:[...new Set(errors)],warnings};

  if(bottomZ>=topZ-EPS){
    warnings.push('Zwischen Rohlingoberseite und geschützter Zielgeometrie ist kein Z-Level-Schruppbereich vorhanden.');
    return{valid:true,topZ,bottomZ:topZ,levels:[],errors:[],warnings};
  }

  const levels:number[]=[];
  let z=topZ;
  while(z-operation.stepDownMm>bottomZ+EPS){
    z-=operation.stepDownMm;
    levels.push(z);
  }
  // The exact lower boundary is always represented once; no overshoot below it.
  if(!levels.length||Math.abs(levels[levels.length-1]-bottomZ)>EPS)levels.push(bottomZ);

  return{valid:true,topZ,bottomZ,levels,errors:[],warnings};
}
