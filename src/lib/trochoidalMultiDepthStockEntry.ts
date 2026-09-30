import type { CanonicalSpatialSegment } from './canonicalToolpath';
import type { SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import { buildTrochoidStockEntryReference, type StockEntryOptions, type StockEntryResult } from './trochoidalStockEntry';

export type MultiDepthStockEntryOptions=Omit<StockEntryOptions,'targetDepthMm'> & {
  totalDepthMm:number;
  stepDownMm:number;
  safeZMm:number;
  rapidFeedMmMin:number;
};

export type MultiDepthLevel={
  depthMm:number;
  approach:CanonicalSpatialSegment[];
  reference:Extract<StockEntryResult,{ok:true}>;
  retract:CanonicalSpatialSegment;
};

export type MultiDepthStockEntryResult=
  | {ok:true;levels:MultiDepthLevel[];errors:[]}
  | {ok:false;levels:[];errors:string[]};

const EPS=1e-9;
const pointAtSafe=(p:{x:number;y:number},safeZMm:number)=>({x:p.x,y:p.y,z:safeZMm});

/**
 * F4 orchestration reference.
 *
 * Each depth is rebuilt from the F3 stock-entry contract. Earlier levels are
 * deliberately not credited as cleared material. Between levels the cutter
 * retracts vertically to safe Z; every lateral positioning move is made there.
 */
export function buildTrochoidMultiDepthStockEntryReference(
  guide:TrochoidalContourGuide,
  loop:Omit<StraightTrochoidOptions,'freeSide'>,
  cutterRadiusMm:number,
  options:MultiDepthStockEntryOptions
):MultiDepthStockEntryResult {
  const fail=(error:string):MultiDepthStockEntryResult=>({ok:false,levels:[],errors:[error]});
  if(!options || ![options.totalDepthMm,options.stepDownMm,options.safeZMm,options.rapidFeedMmMin].every(Number.isFinite)
    || options.totalDepthMm<=0 || options.stepDownMm<=0 || options.safeZMm<=0 || options.rapidFeedMmMin<=0)
    return fail('Mehrfach-Tiefen- und Safe-Z-Parameter sind ungültig.');

  const levelCount=Math.ceil(options.totalDepthMm/options.stepDownMm-EPS);
  if(!Number.isSafeInteger(levelCount) || levelCount<1 || levelCount>512)
    return fail('Tiefenplan überschreitet das Ebenenbudget.');

  const built:Extract<StockEntryResult,{ok:true}>[]=[];
  const depths:number[]=[];
  for(let i=1;i<=levelCount;i++) {
    const depth=Math.min(options.totalDepthMm,i*options.stepDownMm);
    const reference=buildTrochoidStockEntryReference(guide,loop,cutterRadiusMm,{
      allowFullWidthStartup:options.allowFullWidthStartup,
      targetDepthMm:depth,
      maximumRampAngleDeg:options.maximumRampAngleDeg,
      rampFeedMmMin:options.rampFeedMmMin,
      startupFeedMmMin:options.startupFeedMmMin,
      seedExtraRadiusMm:options.seedExtraRadiusMm,
      bootstrapStepMm:options.bootstrapStepMm,
      allowedExposedAngleDeg:options.allowedExposedAngleDeg
    });
    if(!reference.ok)return fail(`Tiefenebene ${i} bei ${depth} mm verworfen: ${reference.errors.join(' ')}`);
    built.push(reference);depths.push(depth);
  }

  const levels:MultiDepthLevel[]=[];
  let previousEnd:{x:number;y:number}|null=null;
  for(let i=0;i<built.length;i++) {
    const reference=built[i];
    const entry=reference.startup.segments[0]?.start;
    const contourEnd=reference.contour.material.segments.at(-1)?.end;
    if(!entry || !contourEnd)return fail(`Tiefenebene ${i+1} besitzt keine vollständige Bewegungskette.`);

    const safeEntry=pointAtSafe(entry,options.safeZMm);
    const approach:CanonicalSpatialSegment[]=[];
    if(previousEnd) {
      const previousSafe=pointAtSafe(previousEnd,options.safeZMm);
      approach.push({kind:'line3',start:previousSafe,end:safeEntry,feedMmMin:options.rapidFeedMmMin});
    }
    approach.push({kind:'line3',start:safeEntry,end:{...entry,z:0},feedMmMin:options.rapidFeedMmMin});

    const retract:CanonicalSpatialSegment={
      kind:'line3',
      start:{...contourEnd,z:-depths[i]},
      end:pointAtSafe(contourEnd,options.safeZMm),
      feedMmMin:options.rapidFeedMmMin
    };
    levels.push({depthMm:depths[i],approach,reference,retract});
    previousEnd=contourEnd;
  }
  return {ok:true,levels,errors:[]};
}
