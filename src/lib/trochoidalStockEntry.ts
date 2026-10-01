import type { CanonicalSpatialSegment } from './canonicalToolpath';
import type { SemanticSegment, P2 } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { buildAssumedSeedRamp } from './trochoidalRampEntry';
import { assessTrochoidalGuideEligibility } from './trochoidalGuideEligibility';
import { buildProtectedTrochoidReference } from './trochoidalLocalRadius';
import { boundMaterialExposureOutsideSeed } from './trochoidalMaterialExposure';
import { constructAssumedDiskFromCircularSweep } from './trochoidalConstructiveSeed';
import { assessProtectedTrochoidSequentialMaterial, proveTrochoidalProtectedEnvelope,
  type ProtectedSequentialResult } from './trochoidalProtectedEnvelope';

export type StockEntryOptions={
  /** Explicit exception for the startup entry only, never for contour loops. */
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
    return fail('Vollbreite Startphase muss ausdrücklich freigegeben sein; keine automatische Ausnahme.');
  if(![cutterRadiusMm,options.targetDepthMm,options.maximumRampAngleDeg,options.rampFeedMmMin,
    options.startupFeedMmMin,options.seedExtraRadiusMm,options.bootstrapStepMm,options.allowedExposedAngleDeg].every(Number.isFinite)
    || cutterRadiusMm<=RESERVE*3 || options.targetDepthMm<=0 || options.startupFeedMmMin<=0
    || options.seedExtraRadiusMm<RESERVE || options.bootstrapStepMm<=0
    || options.allowedExposedAngleDeg<=0 || options.allowedExposedAngleDeg>=180)
    return fail('Startphasen- und Bootstrap-Parameter sind ungültig.');
  const eligible=assessTrochoidalGuideEligibility(guide,loop.radiusMm,loop.forwardStepMm);
  if(!eligible.ok)return fail(eligible.errors.join(' '));
  const target=buildProtectedTrochoidReference(guide,loop,eligible.freeSide,eligible.uniformRadiusMm,
    cutterRadiusMm,options.allowedExposedAngleDeg);
  if(!target.ok || target.segments[0]?.kind!=='arc')return fail('Native Konturreferenz fehlt.');
  const first=target.segments[0],center={...first.center};
  const unit={x:(first.start.x-center.x)/first.radius,y:(first.start.y-center.y)/first.radius};
  const at=(r:number):P2=>({x:center.x+unit.x*r,y:center.y+unit.y*r});
  const finalRadius=eligible.uniformRadiusMm+options.seedExtraRadiusMm+MARGIN;
  // Largest centre-covering circular startup: the final planar sweep can only
  // prove a solid disk when its centreline radius remains below cutter radius.
  const initialRadius=Math.min(cutterRadiusMm-RESERVE,finalRadius);
  const count=Math.max(0,Math.ceil((finalRadius-initialRadius)/options.bootstrapStepMm));
  if(!Number.isFinite(finalRadius) || initialRadius<=RESERVE || !Number.isInteger(count) || count>MAX_LOOPS)
    return fail('Bootstrap überschreitet das Geometrie- oder Schleifenbudget.');
  const footprintRadius=finalRadius+cutterRadiusMm;
  // This is an enclosure, not credited cleared material. Part protection is
  // purely geometric and is checked before any startup path is returned.
  const enclosure={center,radiusMm:footprintRadius+2*RESERVE,clearedToDepthMm:options.targetDepthMm};
  const part=proveTrochoidalProtectedEnvelope(guide,target.segments,cutterRadiusMm,enclosure);
  if(!part.ok)return fail(part.errors.join(' '));
  const east=at(initialRadius),west=at(-initialRadius);
  const ramp=buildAssumedSeedRamp(enclosure,east,cutterRadiusMm,
    {startDepthMm:0,targetDepthMm:options.targetDepthMm,maximumAngleDeg:options.maximumRampAngleDeg,
      feedMmMin:options.rampFeedMmMin});
  if(!ramp.ok)return fail(ramp.errors.join(' '));
  const z=-options.targetDepthMm;
  // A full target-depth circle follows the helix. Only this actually executed
  // planar sweep is credited as cleared material; the descending helix itself
  // receives no stock-removal credit.
  const seedSweep:SemanticSegment[]=[
    {kind:'arc',start:east,end:west,center:{...center},radius:initialRadius,ccw:first.ccw},
    {kind:'arc',start:west,end:east,center:{...center},radius:initialRadius,ccw:first.ccw}
  ];
  const constructed=constructAssumedDiskFromCircularSweep(seedSweep,cutterRadiusMm,options.targetDepthMm);
  if(!constructed.ok)return fail(constructed.errors.join(' '));
  let disk:AssumedClearedDisk=constructed.disk,previous=east;
  const startup:CanonicalSpatialSegment[]=[...ramp.segments,
    ...seedSweep.map(s=>s.kind==='arc'
      ?{kind:'arc3' as const,start:{...s.start,z},end:{...s.end,z},center:{...s.center},ccw:s.ccw,feedMmMin:options.startupFeedMmMin}
      :{kind:'line3' as const,start:{...s.start,z},end:{...s.end,z},feedMmMin:options.startupFeedMmMin})];
  const bootstrap:SemanticSegment[]=[],bounds:number[]=[];
  for(let i=1;i<=count;i++) {
    const r=i===count?finalRadius:Math.min(finalRadius,initialRadius+i*options.bootstrapStepMm);
    const nextEast=at(r),nextWest=at(-r);
    const arcs:SemanticSegment[]=[{kind:'arc',start:nextEast,end:nextWest,center:{...center},radius:r,ccw:first.ccw},
      {kind:'arc',start:nextWest,end:nextEast,center:{...center},radius:r,ccw:first.ccw}];
    const link:SemanticSegment={kind:'line',start:{...previous},end:nextEast};
    const exposure=boundMaterialExposureOutsideSeed(disk,[link,...arcs],cutterRadiusMm,
      options.targetDepthMm,options.allowedExposedAngleDeg);
    if(!exposure.ok || exposure.maxExposedAngleDeg===null)return fail(exposure.errors.join(' '));
    if(Math.max(0,r-cutterRadiusMm)+MARGIN>disk.radiusMm-MARGIN)
      return fail('Bootstrap hinterlässt ein ungedecktes Innenloch.');
    disk={center:{...center},radiusMm:r+cutterRadiusMm-MARGIN,clearedToDepthMm:options.targetDepthMm};
    bootstrap.push(link,...arcs);bounds.push(exposure.maxExposedAngleDeg);previous=nextEast;
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
