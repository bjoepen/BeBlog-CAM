import type { P2, SemanticSegment } from './contourMath';
import type { CanonicalSpatialSegment } from './canonicalToolpath';
import { proveAssumedSeedClearance, type AssumedClearedDisk } from './trochoidalSeedClearance';
import { assessProtectedTrochoidSequentialMaterial, type ProtectedSequentialResult } from './trochoidalProtectedEnvelope';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';

export type SeedRampOptions = {
  startDepthMm: number; targetDepthMm: number; maximumAngleDeg: number; feedMmMin: number;
};
export type SeedRampResult =
  | {ok:true; segments:CanonicalSpatialSegment[]; legCount:number; xyLengthMm:number; actualAngleDeg:number; errors:[]}
  | {ok:false; segments:[]; legCount:0; xyLengthMm:0; actualAngleDeg:null; errors:string[]};

const RESERVE_MM=1e-5;
const MAX_LEGS=2048;

/** Linear pendulum ramp inside an assumed already-cleared cylinder. No stock removal credit. */
export function buildAssumedSeedRamp(
  disk:AssumedClearedDisk, endpoint:P2, cutterRadiusMm:number, options:SeedRampOptions
):SeedRampResult {
  const fail=(error:string):SeedRampResult=>({ok:false,segments:[],legCount:0,xyLengthMm:0,actualAngleDeg:null,errors:[error]});
  if(!disk?.center || !endpoint || !options
    || ![disk.center.x,disk.center.y,disk.radiusMm,disk.clearedToDepthMm,endpoint.x,endpoint.y,
      cutterRadiusMm,options.startDepthMm,options.targetDepthMm,options.maximumAngleDeg,options.feedMmMin].every(Number.isFinite)
    || cutterRadiusMm<=0 || disk.radiusMm<=0 || disk.clearedToDepthMm<=0
    || options.startDepthMm<0 || options.targetDepthMm<=options.startDepthMm
    || options.targetDepthMm>disk.clearedToDepthMm || options.maximumAngleDeg<=0
    || options.maximumAngleDeg>15 || options.feedMmMin<=0)
    return fail('Rampendaten oder angenommene Tiefenfreigabe sind ungültig.');
  const dx=endpoint.x-disk.center.x,dy=endpoint.y-disk.center.y;
  const radial=Math.hypot(dx,dy),legLength=2*radial;
  if(!Number.isFinite(legLength) || legLength<=RESERVE_MM
    || disk.radiusMm-radial-cutterRadiusMm<RESERVE_MM)
    return fail('Rampenendpunkt bietet keine belastbare Pendelstrecke innerhalb der Startzone.');
  const opposite={x:disk.center.x-dx,y:disk.center.y-dy};
  const drop=options.targetDepthMm-options.startDepthMm;
  const requiredLength=drop/Math.tan(options.maximumAngleDeg*Math.PI/180);
  const legCount=2*Math.ceil(requiredLength/(2*legLength)*(1+64*Number.EPSILON));
  const xyLengthMm=legCount*legLength;
  const actualAngleDeg=Math.atan2(drop,xyLengthMm)*180/Math.PI;
  const scale=Math.max(disk.radiusMm,cutterRadiusMm,options.targetDepthMm,
    Math.abs(disk.center.x),Math.abs(disk.center.y),Math.abs(endpoint.x),Math.abs(endpoint.y),
    Math.abs(opposite.x),Math.abs(opposite.y));
  if(!Number.isFinite(requiredLength) || !Number.isFinite(xyLengthMm) || !Number.isInteger(legCount)
    || legCount<2 || legCount>MAX_LEGS || actualAngleDeg>options.maximumAngleDeg
    || 64*Number.EPSILON*scale>1e-7)
    return fail('Rampe überschreitet Winkel-, Segment- oder numerisches Reservebudget.');
  const planar:SemanticSegment[]=[],segments:CanonicalSpatialSegment[]=[];
  for(let i=0;i<legCount;i++) {
    const start=i%2===0?endpoint:opposite,end=i%2===0?opposite:endpoint;
    const z0=-(options.startDepthMm+drop*i/legCount);
    const z1=i===legCount-1?-options.targetDepthMm:-(options.startDepthMm+drop*(i+1)/legCount);
    // Check emitted moves too: depth subtraction must not erase a tiny drop.
    const angle=Math.atan2(z0-z1,Math.hypot(end.x-start.x,end.y-start.y))*180/Math.PI;
    if(!(z1<z0) || angle>options.maximumAngleDeg)
      return fail('Eine Rampenbewegung ist numerisch nicht strikt abwärts oder zu steil.');
    planar.push({kind:'line',start:{...start},end:{...end}});
    segments.push({kind:'line3',start:{...start,z:z0},end:{...end,z:z1},feedMmMin:options.feedMmMin});
  }
  const clearance=proveAssumedSeedClearance(disk,planar,cutterRadiusMm,options.targetDepthMm);
  if(!clearance.ok)return fail(clearance.errors.join(' '));
  return{ok:true,segments,legCount,xyLengthMm,actualAngleDeg,errors:[]};
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
