import type { CanonicalSpatialSegment } from './canonicalToolpath';
import type { SemanticSegment, P2 } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { buildAssumedSeedRamp } from './trochoidalRampEntry';
import { assessTrochoidalGuideEligibility } from './trochoidalGuideEligibility';
import { buildSemanticTrochoid } from './trochoidalSemanticMath';
import { boundMaterialExposureOutsideSeed } from './trochoidalMaterialExposure';
import { constructAssumedDiskFromCircularSweep } from './trochoidalConstructiveSeed';
import { assessProtectedTrochoidSequentialMaterial, proveTrochoidalProtectedEnvelope,
  type ProtectedSequentialResult } from './trochoidalProtectedEnvelope';

export type StockEntryOptions={
  /** Explicit exception for the startup slot only, never for contour loops. */
  allowFullWidthStartup:boolean;
  targetDepthMm:number; maximumRampAngleDeg:number; rampFeedMmMin:number; startupFeedMmMin:number;
  seedExtraRadiusMm:number; bootstrapStepMm:number; allowedExposedAngleDeg:number;
};
export type StockEntryResult=
  | {ok:true; startup:{fullWidth:true;segments:CanonicalSpatialSegment[];rampLegCount:number};
      bootstrap:SemanticSegment[]; bootstrapExposureBoundsDeg:number[]; seed:AssumedClearedDisk;
      bridge:SemanticSegment; bridgeExposureBoundDeg:number;
      contour:Extract<ProtectedSequentialResult,{ok:true}>;errors:[]}
  | {ok:false;startup:null;bootstrap:[];bootstrapExposureBoundsDeg:[];seed:null;
      bridge:null;bridgeExposureBoundDeg:null;contour:null;errors:string[]};

const MARGIN=1e-6,RESERVE=1e-5,MAX_LOOPS=512;

/** Stock-cutting startup reference. No prior cleared disk is accepted as input. */
export function buildTrochoidStockEntryReference(
  guide:TrochoidalContourGuide, loop:Omit<StraightTrochoidOptions,'freeSide'>,
  cutterRadiusMm:number, options:StockEntryOptions
):StockEntryResult {
  const fail=(error:string):StockEntryResult=>({ok:false,startup:null,bootstrap:[],bootstrapExposureBoundsDeg:[],
    seed:null,bridge:null,bridgeExposureBoundDeg:null,contour:null,errors:[error]});
  if(!options || !loop || options.allowFullWidthStartup!==true)
    return fail('Vollbreite Startnut muss ausdrücklich freigegeben sein; keine automatische Ausnahme.');
  if(![cutterRadiusMm,options.targetDepthMm,options.maximumRampAngleDeg,options.rampFeedMmMin,
    options.startupFeedMmMin,options.seedExtraRadiusMm,options.bootstrapStepMm,options.allowedExposedAngleDeg].every(Number.isFinite)
    || cutterRadiusMm<=RESERVE*3 || options.targetDepthMm<=0 || options.startupFeedMmMin<=0
    || options.seedExtraRadiusMm<RESERVE || options.bootstrapStepMm<=0
    || options.allowedExposedAngleDeg<=0 || options.allowedExposedAngleDeg>=180)
    return fail('Startnut- und Bootstrap-Parameter sind ungültig.');
  const eligible=assessTrochoidalGuideEligibility(guide,loop.radiusMm,loop.forwardStepMm);
  if(!eligible.ok)return fail(eligible.errors.join(' '));
  const target=buildSemanticTrochoid(guide.segments,{...loop,radiusMm:eligible.uniformRadiusMm,freeSide:eligible.freeSide});
  if(!target.ok || target.segments[0]?.kind!=='arc')return fail('Native Konturreferenz fehlt.');
  const first=target.segments[0],center={...first.center};
  const unit={x:(first.start.x-center.x)/first.radius,y:(first.start.y-center.y)/first.radius};
  const at=(r:number):P2=>({x:center.x+unit.x*r,y:center.y+unit.y*r});
  const finalRadius=eligible.uniformRadiusMm+options.seedExtraRadiusMm+MARGIN;
  const initialRadius=Math.min(cutterRadiusMm/3,finalRadius);
  const halfChord=cutterRadiusMm+initialRadius+RESERVE;
  const count=Math.ceil((finalRadius-initialRadius)/options.bootstrapStepMm)+1;
  if(!Number.isFinite(finalRadius) || initialRadius<=RESERVE || !Number.isInteger(count) || count>MAX_LOOPS)
    return fail('Bootstrap überschreitet das Geometrie- oder Schleifenbudget.');
  const footprintRadius=Math.max(halfChord+cutterRadiusMm,finalRadius+cutterRadiusMm);
  // This is an enclosure, not credited cleared material. Part protection is
  // purely geometric and is checked before any startup path is returned.
  const enclosure={center,radiusMm:footprintRadius+2*RESERVE,clearedToDepthMm:options.targetDepthMm};
  const part=proveTrochoidalProtectedEnvelope(guide,target.segments,cutterRadiusMm,enclosure);
  if(!part.ok)return fail(part.errors.join(' '));
  const ramp=buildAssumedSeedRamp(enclosure,at(halfChord),cutterRadiusMm,
    {startDepthMm:0,targetDepthMm:options.targetDepthMm,maximumAngleDeg:options.maximumRampAngleDeg,
      feedMmMin:options.rampFeedMmMin});
  if(!ramp.ok)return fail(ramp.errors.join(' '));
  const negative=at(-halfChord),positive=at(halfChord),z=-options.targetDepthMm;
  // Descending ramp alone does NOT clear the chord to final depth. Complete
  // it at target depth, then return to its middle before bootstrapping.
  const startup:CanonicalSpatialSegment[]=[...ramp.segments,
    {kind:'line3',start:{...positive,z},end:{...negative,z},feedMmMin:options.startupFeedMmMin},
    {kind:'line3',start:{...negative,z},end:{...center,z},feedMmMin:options.startupFeedMmMin}];
  const bootstrap:SemanticSegment[]=[],bounds:number[]=[];
  let disk:AssumedClearedDisk|null=null,previous=center;
  for(let i=0;i<count;i++) {
    const r=i===count-1?finalRadius:initialRadius+i*options.bootstrapStepMm;
    const east=at(r),west=at(-r);
    const arcs:SemanticSegment[]=[{kind:'arc',start:east,end:west,center:{...center},radius:r,ccw:first.ccw},
      {kind:'arc',start:west,end:east,center:{...center},radius:r,ccw:first.ccw}];
    const link:SemanticSegment={kind:'line',start:{...previous},end:east};
    let bound:number;
    if(i===0) {
      // The completed target-depth slot contains a rectangle with half-length
      // halfChord and half-width R. First-link/circle cutter footprints fit
      // its X span. Bound circumference outside the eroded infinite Y strip.
      const h=cutterRadiusMm-MARGIN;
      const angle=(threshold:number)=>2*Math.acos(Math.max(-1,Math.min(1,threshold/cutterRadiusMm)))*180/Math.PI;
      bound=Math.max(angle(h-r),2*angle(h))+1e-5;
      if(bound>options.allowedExposedAngleDeg)return fail('Erster Bootstrap-Kreis überschreitet den Eingriff nach der Startnut.');
      const constructed=constructAssumedDiskFromCircularSweep(arcs,cutterRadiusMm,options.targetDepthMm);
      if(!constructed.ok)return fail(constructed.errors.join(' '));
      disk=constructed.disk;
    } else {
      const exposure=boundMaterialExposureOutsideSeed(disk!,[link,...arcs],cutterRadiusMm,
        options.targetDepthMm,options.allowedExposedAngleDeg);
      if(!exposure.ok || exposure.maxExposedAngleDeg===null)return fail(exposure.errors.join(' '));
      bound=exposure.maxExposedAngleDeg;
      // Same-center annulus plus the previous disk fills any central hole.
      if(Math.max(0,r-cutterRadiusMm)+MARGIN>disk!.radiusMm-MARGIN)
        return fail('Bootstrap hinterlässt ein ungedecktes Innenloch.');
      disk={center:{...center},radiusMm:r+cutterRadiusMm-MARGIN,clearedToDepthMm:options.targetDepthMm};
    }
    bootstrap.push(link,...arcs);bounds.push(bound);previous=east;
  }
  const bridge:SemanticSegment={kind:'line',start:{...previous},end:{...first.start}};
  const bridgeProof=boundMaterialExposureOutsideSeed(disk!,[bridge],cutterRadiusMm,
    options.targetDepthMm,options.allowedExposedAngleDeg);
  if(!bridgeProof.ok || bridgeProof.maxExposedAngleDeg===null)return fail(bridgeProof.errors.join(' '));
  const contour=assessProtectedTrochoidSequentialMaterial(guide,loop,disk!,cutterRadiusMm,
    options.targetDepthMm,options.allowedExposedAngleDeg);
  if(!contour.ok)return fail(contour.errors.join(' '));
  return {ok:true,startup:{fullWidth:true,segments:startup,rampLegCount:ramp.legCount},bootstrap,
    bootstrapExposureBoundsDeg:bounds,seed:disk!,bridge,bridgeExposureBoundDeg:bridgeProof.maxExposedAngleDeg,
    contour,errors:[]};
}
