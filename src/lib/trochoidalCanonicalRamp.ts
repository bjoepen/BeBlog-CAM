import type { CanonicalToolpath } from './canonicalToolpath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { constructAssumedDiskFromCanonicalRun } from './trochoidalCanonicalSeed';
import { proveTrochoidalProtectedEnvelope } from './trochoidalProtectedEnvelope';
import { buildProtectedTrochoidRampReference, type ProtectedRampReferenceResult,
  type SeedRampOptions } from './trochoidalRampEntry';

/** Explicit caller assertions until real job ordering and setup binding exist. */
export type CanonicalRampContext = {
  sourceFrameId:string; targetFrameId:string;
  sourceOperationIndex:number; targetOperationIndex:number; targetOperationId:string;
};
export type CanonicalRampReferenceResult =
  | {ok:true; reference:Extract<ProtectedRampReferenceResult,{ok:true}>;
      source:{operationId:string;runIndex:number;frameId:string;operationIndex:number;
        disk:AssumedClearedDisk;footprintRadiusMm:number}; errors:[]}
  | {ok:false;reference:null;source:null;errors:string[]};

/**
 * 010-F2: derive the seed from one exact prior canonical circle cut; protect
 * the complete prior footprint, then compose F1. No execution attestation.
 */
export function buildCanonicalSeedTrochoidRampReference(
  prior:CanonicalToolpath, runIndex:number, context:CanonicalRampContext,
  guide:TrochoidalContourGuide, loopOptions:Omit<StraightTrochoidOptions,'freeSide'>,
  cutterRadiusMm:number, allowedExposedAngleDeg:number, rampOptions:SeedRampOptions
):CanonicalRampReferenceResult {
  const fail=(errors:string[]):CanonicalRampReferenceResult=>({ok:false,reference:null,source:null,errors});
  if(!context || typeof context.sourceFrameId!=='string' || !context.sourceFrameId.trim()
    || context.sourceFrameId!==context.targetFrameId
    || !Number.isInteger(context.sourceOperationIndex) || context.sourceOperationIndex<0
    || !Number.isInteger(context.targetOperationIndex) || context.targetOperationIndex<=context.sourceOperationIndex
    || typeof context.targetOperationId!=='string' || !context.targetOperationId.trim()
    || (typeof prior?.sourceOperationId==='string' && prior.sourceOperationId.trim()===context.targetOperationId.trim()))
    return fail(['Vorherige Quelle benötigt eindeutige Reihenfolge, gemeinsamen Rahmen und getrennte Operationsidentität.']);
  const derived=constructAssumedDiskFromCanonicalRun(prior,runIndex);
  if(!derived.ok)return fail(derived.errors);
  const reference=buildProtectedTrochoidRampReference(guide,loopOptions,derived.disk,
    cutterRadiusMm,allowedExposedAngleDeg,rampOptions);
  if(!reference.ok)return fail(reference.errors);
  const first=prior.runs[runIndex].segments![0];
  if(first.kind!=='arc')return fail(['Kanonischer Kreisschnitt fehlt.']);
  // Derivation subtracts a numeric reserve. Protect the actual full prior
  // footprint too, without relying on that reduced disk or a magic epsilon.
  const footprintRadiusMm=Math.hypot(first.start.x-first.center.x,first.start.y-first.center.y)
    +prior.tool.diameterMm/2;
  const footprint={center:{...derived.disk.center},radiusMm:footprintRadiusMm,
    clearedToDepthMm:derived.disk.clearedToDepthMm};
  const protectedPrior=proveTrochoidalProtectedEnvelope(guide,
    reference.protectedPath.material.segments,cutterRadiusMm,footprint);
  if(!protectedPrior.ok)return fail(protectedPrior.errors);
  return {ok:true,reference,source:{operationId:derived.sourceOperationId,runIndex:derived.runIndex,
    frameId:context.sourceFrameId,operationIndex:context.sourceOperationIndex,
    disk:{...derived.disk,center:{...derived.disk.center}},footprintRadiusMm},errors:[]};
}
