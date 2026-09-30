import type { CanonicalMachineMotion, CanonicalSpatialSegment } from './canonicalToolpath';
import type { SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import { buildTrochoidMultiDepthStockEntryReference, type MultiDepthStockEntryOptions,
  type MultiDepthStockEntryResult } from './trochoidalMultiDepthStockEntry';

export type CanonicalMultiDepthLevel={
  depthMm:number;
  motions:CanonicalMachineMotion[];
};

export type CanonicalMultiDepthResult=
  | {ok:true;levels:CanonicalMultiDepthLevel[];motions:CanonicalMachineMotion[];errors:[]}
  | {ok:false;levels:[];motions:[];errors:string[]};

const same3=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>
  a.x===b.x&&a.y===b.y&&a.z===b.z;

function lift(segment:SemanticSegment,z:number,feedMmMin:number):CanonicalSpatialSegment {
  if(segment.kind==='line')return {kind:'line3',start:{...segment.start,z},end:{...segment.end,z},feedMmMin};
  return {kind:'arc3',start:{...segment.start,z},end:{...segment.end,z},center:{...segment.center},
    ccw:segment.ccw,feedMmMin};
}

/** F5: flatten the accepted F4 reference into one explicit canonical 3D motion chain. */
export function buildCanonicalTrochoidMultiDepthReference(
  guide:TrochoidalContourGuide,
  loop:Omit<StraightTrochoidOptions,'freeSide'>,
  cutterRadiusMm:number,
  options:MultiDepthStockEntryOptions
):CanonicalMultiDepthResult {
  const fail=(error:string):CanonicalMultiDepthResult=>({ok:false,levels:[],motions:[],errors:[error]});
  const planned:MultiDepthStockEntryResult=buildTrochoidMultiDepthStockEntryReference(guide,loop,cutterRadiusMm,options);
  if(!planned.ok)return fail(planned.errors.join(' '));

  const levels:CanonicalMultiDepthLevel[]=[],all:CanonicalMachineMotion[]=[];
  for(const [index,level] of planned.levels.entries()) {
    const z=-level.depthMm;
    const approach:CanonicalMachineMotion[]=level.approach.map(s=>s.start.z===options.safeZMm&&s.end.z===options.safeZMm
      ?{kind:'rapid3',start:{...s.start},end:{...s.end}}
      :{...s});
    const cutting:CanonicalSpatialSegment[]=[
      ...level.reference.startup.segments.map(s=>({...s})),
      ...level.reference.bootstrap.map(s=>lift(s,z,options.startupFeedMmMin)),
      lift(level.reference.bridge,z,options.startupFeedMmMin),
      ...level.reference.contour.material.segments.map(s=>lift(s,z,options.startupFeedMmMin))
    ];
    const retract:CanonicalSpatialSegment={...level.retract};
    const motions:CanonicalMachineMotion[]=[...approach,...cutting,retract];
    if(!motions.length)return fail(`Tiefenebene ${index+1} enthält keine kanonischen Bewegungen.`);
    for(let i=1;i<motions.length;i++)
      if(!same3(motions[i-1].end,motions[i].start))
        return fail(`Kanonische Bewegungskette ist auf Tiefenebene ${index+1} unterbrochen.`);
    if(index>0 && !same3(all.at(-1)!.end,motions[0].start))
      return fail(`Kanonische Ebenenverkettung ist vor Tiefenebene ${index+1} unterbrochen.`);
    levels.push({depthMm:level.depthMm,motions});all.push(...motions);
  }
  return {ok:true,levels,motions:all,errors:[]};
}
