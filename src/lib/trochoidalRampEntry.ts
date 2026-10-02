import type { P2, SemanticSegment } from './contourMath';
import type { CanonicalSpatialSegment } from './canonicalToolpath';
import { buildCanonicalHelicalDescent } from './helicalMotion';
import { proveAssumedSeedClearance, type AssumedClearedDisk } from './trochoidalSeedClearance';
import { assessProtectedTrochoidSequentialMaterial, type ProtectedSequentialResult } from './trochoidalProtectedEnvelope';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';

export type SeedRampOptions = {
  startDepthMm: number; targetDepthMm: number; maximumAngleDeg: number; feedMmMin: number;
};
export type SeedRampResult =
  | {ok:true; segments:CanonicalSpatialSegment[]; turnCount:number; xyLengthMm:number; actualAngleDeg:number; errors:[]}
  | {ok:false; segments:[]; turnCount:0; xyLengthMm:0; actualAngleDeg:null; errors:string[]};

const RESERVE_MM=1e-5;
const MAX_LEGS=2048;

/** Circular ramp inside an assumed protected cylinder. No stock-removal credit.
 * The endpoint defines the ramp radius and the ramp ends exactly at endpoint. */
export function buildAssumedSeedRamp(
  disk:AssumedClearedDisk, endpoint:P2, cutterRadiusMm:number, options:SeedRampOptions
):SeedRampResult {
  const fail=(error:string):SeedRampResult=>({ok:false,segments:[],turnCount:0,xyLengthMm:0,actualAngleDeg:null,errors:[error]});
  if(!disk?.center || !endpoint || !options
    || ![disk.center.x,disk.center.y,disk.radiusMm,disk.clearedToDepthMm,endpoint.x,endpoint.y,
      cutterRadiusMm,options.startDepthMm,options.targetDepthMm,options.maximumAngleDeg,options.feedMmMin].every(Number.isFinite)
    || cutterRadiusMm<=0 || disk.radiusMm<=0 || disk.clearedToDepthMm<=0
    || options.startDepthMm<0 || options.targetDepthMm<=options.startDepthMm
    || options.targetDepthMm>disk.clearedToDepthMm || options.maximumAngleDeg<=0
    || options.maximumAngleDeg>15 || options.feedMmMin<=0)
    return fail('Rampendaten oder angenommene Tiefenfreigabe sind ungültig.');
  const dx=endpoint.x-disk.center.x,dy=endpoint.y-disk.center.y;
  const radius=Math.hypot(dx,dy);
  if(!Number.isFinite(radius)||radius<=RESERVE_MM||disk.radiusMm-radius-cutterRadiusMm<RESERVE_MM)
    return fail('Rampenendpunkt bietet keinen belastbaren Kreis innerhalb der Startzone.');
  const drop=options.targetDepthMm-options.startDepthMm;
  const requiredLength=drop/Math.tan(options.maximumAngleDeg*Math.PI/180);
  const circumference=2*Math.PI*radius;
  const turns=Math.max(1,Math.ceil(requiredLength/circumference*(1+64*Number.EPSILON)));
  const xyLengthMm=turns*circumference;
  const actualAngleDeg=Math.atan2(drop,xyLengthMm)*180/Math.PI;
  if(!Number.isFinite(requiredLength)||!Number.isFinite(xyLengthMm)||!Number.isInteger(turns)
    ||turns>MAX_LEGS||actualAngleDeg>options.maximumAngleDeg)
    return fail('Kreisrampe überschreitet Winkel-, Umlauf- oder numerisches Reservebudget.');
  const pitchMm=drop/turns;
  const helix=buildCanonicalHelicalDescent({
    centerX:disk.center.x,centerY:disk.center.y,radiusMm:radius,
    startZ:-options.startDepthMm,targetZ:-options.targetDepthMm,pitchMm,feedMmMin:options.feedMmMin
  });
  if(!helix.ok||helix.turns!==turns)return fail(helix.error??'Kanonische Kreisrampe konnte nicht erzeugt werden.');
  const segments=helix.segments;
  // The shared primitive starts at centerX+radius. Rotate its XY geometry onto the
  // requested endpoint while preserving centre, winding and Z.
  const baseAngle=Math.atan2(dy,dx);
  const rotate=(p:P2):P2=>{
    const x=p.x-disk.center.x,y=p.y-disk.center.y,ca=Math.cos(baseAngle),sa=Math.sin(baseAngle);
    return{x:disk.center.x+x*ca-y*sa,y:disk.center.y+x*sa+y*ca};
  };
  const rotated:CanonicalSpatialSegment[]=segments.map((segment,index)=>{
    if(segment.kind!=='arc3')throw new Error('Helixprimitive enthält unerwartetes Segment.');
    const start=index===0?{...endpoint}:{...rotate(segment.start)};
    const end=index===segments.length-1?{...endpoint}:{...rotate(segment.end)};
    return{...segment,start:{...start,z:segment.start.z},end:{...end,z:segment.end.z},center:{...disk.center}};
  });
  const planar:SemanticSegment[]=rotated.map(segment=>{
    if(segment.kind!=='arc3')throw new Error('Helixprimitive enthält unerwartetes Segment.');
    return{kind:'arc',start:{x:segment.start.x,y:segment.start.y},end:{x:segment.end.x,y:segment.end.y},center:{...disk.center},radius,ccw:segment.ccw};
  });
  const clearance=proveAssumedSeedClearance(disk,planar,cutterRadiusMm,options.targetDepthMm);
  if(!clearance.ok)return fail(clearance.errors.join(' '));
  return{ok:true,segments:rotated,turnCount:turns,xyLengthMm,actualAngleDeg,errors:[]};
}

export type ProtectedRampReferenceResult=
  | {ok:true; ramp:Extract<SeedRampResult,{ok:true}>; protectedPath:Extract<ProtectedSequentialResult,{ok:true}>; errors:[]}
  | {ok:false; ramp:null; protectedPath:null; errors:string[]};

/** One target layer: ramp ends exactly at the generated, protected first loop apex. */
export function buildProtectedTrochoidRampReference(
  guide:TrochoidalContourGuide, loopOptions:Omit<StraightTrochoidOptions,'freeSide'>,
  disk:AssumedClearedDisk, cutterRadiusMm:number, allowedExposedAngleDeg:number, rampOptions:SeedRampOptions
):ProtectedRampReferenceResult {
  const fail=(errors:string[]):ProtectedRampReferenceResult=>({ok:false,ramp:null,protectedPath:null,errors});
  if(!rampOptions)return fail(['Rampendaten fehlen.']);
  const protectedPath=assessProtectedTrochoidSequentialMaterial(guide,loopOptions,disk,
    cutterRadiusMm,rampOptions.targetDepthMm,allowedExposedAngleDeg);
  if(!protectedPath.ok)return fail(protectedPath.errors);
  const first=protectedPath.material.segments[0];
  const ramp=buildAssumedSeedRamp(disk,first.start,cutterRadiusMm,rampOptions);
  if(!ramp.ok)return fail(ramp.errors);
  return{ok:true,ramp,protectedPath,errors:[]};
}
