import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';
import type { MultiDepthStockEntryOptions } from './trochoidalMultiDepthStockEntry';
import { buildCanonicalTrochoidMultiDepthReference } from './trochoidalCanonicalMultiDepth';

export type TrochoidalCanonicalToolpathResult=
  | {ok:true;toolpath:CanonicalToolpath;errors:[]}
  | {ok:false;toolpath:null;errors:string[]};

const planar=(segment:CanonicalSpatialSegment)=>segment.start.z===segment.end.z;

export function buildTrochoidalCanonicalToolpath(
  guide:TrochoidalContourGuide,
  loop:Omit<StraightTrochoidOptions,'freeSide'>,
  cutterRadiusMm:number,
  sourceOperationId:string,
  options:MultiDepthStockEntryOptions
):TrochoidalCanonicalToolpathResult {
  const fail=(error:string):TrochoidalCanonicalToolpathResult=>({ok:false,toolpath:null,errors:[error]});
  if(typeof sourceOperationId!=='string'||!sourceOperationId.trim())
    return fail('Kanonischer Trochoid-Toolpath benötigt eine stabile Operationsquelle.');
  if(!Number.isFinite(cutterRadiusMm)||cutterRadiusMm<=0)
    return fail('Kanonischer Trochoid-Toolpath benötigt einen gültigen Fräserradius.');

  const canonical=buildCanonicalTrochoidMultiDepthReference(guide,loop,cutterRadiusMm,options);
  if(!canonical.ok)return fail(canonical.errors.join(' '));

  const runs:CanonicalToolpathRun[]=canonical.levels.map(level=>{
    const z=-level.depthMm;
    const cutSegments3=level.motions.filter((motion):motion is CanonicalSpatialSegment=>
      motion.kind!=='rapid3'&&planar(motion)&&motion.start.z===z);
    const firstCutIndex=level.motions.findIndex(motion=>
      motion.kind!=='rapid3'&&motion.start.z===z&&motion.end.z===z);
    const entrySegments=level.motions.slice(0,firstCutIndex).filter((motion):motion is CanonicalSpatialSegment=>
      motion.kind!=='rapid3'&&motion.start.z<=0&&motion.end.z<=0);
    const points=cutSegments3.length
      ?[{x:cutSegments3[0].start.x,y:cutSegments3[0].start.y},...cutSegments3.map(s=>({x:s.end.x,y:s.end.y}))]
      :[];
    return {kind:'cut',z,points,cutSegments3,entrySegments,retractAfter:true};
  });
  if(runs.some(run=>!run.points.length||!run.cutSegments3?.length))
    return fail('Kanonischer Trochoid-Toolpath enthält eine leere Schnittebene.');

  return {ok:true,toolpath:{
    version:1,
    operationKind:'contour',
    strategy:'contour',
    tool:{diameterMm:cutterRadiusMm*2},
    stepoverPercent:0,
    runs,
    motions:canonical.motions.map(m=>({...m})),
    sourceOperationId:sourceOperationId.trim()
  },errors:[]};
}
