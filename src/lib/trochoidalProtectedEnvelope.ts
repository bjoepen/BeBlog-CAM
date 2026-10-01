import type { SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import { proveTrochoidalCircleGuideBoundary, radialBoundsForNativeSegment } from './trochoidalCircularBoundary';
import { proveTrochoidalCapsuleGuideBoundary, capsuleDiskPartClearanceMm } from './trochoidalCapsuleBoundary';
import { proveTrochoidalRectangleGuideBoundary, rectanglePointClearanceMm } from './trochoidalRectangleBoundary';
import { assessCircularTrochoidSequentialMaterial, assessCapsuleTrochoidSequentialMaterial,
  assessRectangleTrochoidSequentialMaterial, type SequentialMaterialResult } from './trochoidalSequentialMaterial';

export type ProtectedEnvelopeProof = {
  ok: boolean; minimumPartClearanceMm: number | null; errors: string[];
};
// Exceeds the native boundary tolerances (capsule 1e-6, circle 1e-7 mm).
const RESERVE_MM = 1e-5;

/**
 * 010-E6E: protect the source with the full cutter disk and initial seed disk.
 * Native convex parallel offsets only; not seed provenance or ramp approval.
 */
export function proveTrochoidalProtectedEnvelope(
  guide: TrochoidalContourGuide, path: SemanticSegment[], cutterRadiusMm: number,
  initialDisk: AssumedClearedDisk
): ProtectedEnvelopeProof {
  const fail = (error: string): ProtectedEnvelopeProof => ({ok:false,minimumPartClearanceMm:null,errors:[error]});
  if (!guide || !Array.isArray(guide.source) || !Array.isArray(guide.segments)
    || !Array.isArray(path) || path.length === 0
    || !Number.isFinite(cutterRadiusMm) || cutterRadiusMm <= 0
    || !initialDisk?.center || !Number.isFinite(initialDisk.center.x) || !Number.isFinite(initialDisk.center.y)
    || !Number.isFinite(initialDisk.radiusMm) || initialDisk.radiusMm <= 0
    || !Number.isFinite(initialDisk.clearedToDepthMm) || initialDisk.clearedToDepthMm <= 0)
    return fail('Werkzeughülle oder angenommene Startscheibe ist ungültig.');
  const native = [...guide.source, ...guide.segments, ...path];
  if (native.some(s => !radialBoundsForNativeSegment(s, {x:0,y:0})))
    return fail('Werkzeughüllenprüfung benötigt gültige native LINE/ARC-Geometrie.');
  let scale = Math.max(cutterRadiusMm, initialDisk.radiusMm,
    Math.abs(initialDisk.center.x), Math.abs(initialDisk.center.y));
  for (const s of native) scale=Math.max(scale,
    Math.abs(s.start.x),Math.abs(s.start.y),Math.abs(s.end.x),Math.abs(s.end.y),
    ...(s.kind==='arc'?[Math.abs(s.center.x),Math.abs(s.center.y),s.radius]:[]));
  if (!Number.isFinite(scale) || 64*Number.EPSILON*scale > 1e-7)
    return fail('Koordinatengröße überschreitet das numerische Schutzreservebudget.');
  let seedClearance: number | null;
  if (guide.source.length === 2) {
    const proof = proveTrochoidalCircleGuideBoundary(guide,path);
    if (!proof.ok) return fail(proof.errors.join(' '));
    const source = guide.source[0];
    if(source.kind!=='arc') return fail('Native Kreisquelle fehlt.');
    const d=Math.hypot(initialDisk.center.x-source.center.x,initialDisk.center.y-source.center.y);
    seedClearance=guide.side==='outside'?d-initialDisk.radiusMm-source.radius
      :source.radius-d-initialDisk.radiusMm;
  } else if (guide.source.length === 4 && guide.segments.length === 4) {
    const proof=proveTrochoidalCapsuleGuideBoundary(guide,path);
    if(!proof.ok) return fail(proof.errors.join(' '));
    seedClearance=capsuleDiskPartClearanceMm(guide,initialDisk);
  } else if (guide.source.length === 4 && guide.segments.length === 8 && guide.side==='outside') {
    const proof=proveTrochoidalRectangleGuideBoundary(guide,path,false);
    if(!proof.ok) return fail(proof.errors.join(' '));
    const pointClearance=rectanglePointClearanceMm(guide,initialDisk.center);
    seedClearance=pointClearance===null?null:pointClearance-initialDisk.radiusMm;
  } else return fail('Werkzeughüllenschutz unterstützt nur native Kreis-, Kapsel- und Rechteck-Außenquellen.');
  // For these convex parallel offsets, every centre on the allowed guide
  // side has source clearance >= |offset|. Subtract the cutter radius.
  const cutterClearance=Math.abs(guide.signedOffsetMm)-cutterRadiusMm;
  if(seedClearance===null || !Number.isFinite(seedClearance) || seedClearance<RESERVE_MM)
    return fail('Angenommene Startscheibe berührt oder verletzt die geschützte Sollkonturseite.');
  if(!Number.isFinite(cutterClearance) || cutterClearance<RESERVE_MM)
    return fail('Offset enthält den Werkzeugradius nicht mit ausreichender Schutzreserve.');
  return {ok:true,minimumPartClearanceMm:Math.min(seedClearance,cutterClearance)-RESERVE_MM,errors:[]};
}

export type ProtectedSequentialResult =
  | {ok:true; material:Extract<SequentialMaterialResult,{ok:true}>; minimumPartClearanceMm:number; errors:[]}
  | {ok:false; material:null; minimumPartClearanceMm:null; errors:string[]};

/** Internally generated reference only; failed protection exposes no partial path. */
export function assessProtectedTrochoidSequentialMaterial(
  guide:TrochoidalContourGuide, options:Omit<StraightTrochoidOptions,'freeSide'>,
  initialDisk:AssumedClearedDisk, cutterRadiusMm:number, targetDepthMm:number, allowedExposedAngleDeg:number
):ProtectedSequentialResult {
  const fail=(errors:string[]):ProtectedSequentialResult=>({ok:false,material:null,minimumPartClearanceMm:null,errors});
  const assessor=guide?.source?.length===2?assessCircularTrochoidSequentialMaterial
    :guide?.source?.length===4&&guide?.segments?.length===4?assessCapsuleTrochoidSequentialMaterial
    :guide?.source?.length===4&&guide?.segments?.length===8&&guide.side==='outside'?assessRectangleTrochoidSequentialMaterial:null;
  if(!assessor) return fail(['Native Kreis-, Kapsel- oder Rechteck-Außenführung fehlt.']);
  const material=assessor(guide,options,initialDisk,cutterRadiusMm,targetDepthMm,allowedExposedAngleDeg);
  if(!material.ok) return fail(material.errors);
  const protection=proveTrochoidalProtectedEnvelope(guide,material.segments,cutterRadiusMm,initialDisk);
  if(!protection.ok || protection.minimumPartClearanceMm===null) return fail(protection.errors);
  // E6B's coverage proof implies propagated disks stay protected too: each
  // is a subset of the old protected disk and the completed protected sweep.
  return {ok:true,material,minimumPartClearanceMm:protection.minimumPartClearanceMm,errors:[]};
}
