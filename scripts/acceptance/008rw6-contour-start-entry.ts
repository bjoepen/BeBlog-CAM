import { applyContourStartPlacement } from '../../src/lib/contourStartPlacement';
import { applyContourEntry } from '../../src/lib/contourEntry';
import { materializeSafeMotionChain } from '../../src/lib/safeMotionChain';
import { defaultContourOperation, type ContourOperation } from '../../src/lib/types';
import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from '../../src/lib/canonicalToolpath';

const p=(x:number,y:number):ToolpathPoint2=>({x,y});
const rectangle=[p(0,0),p(40,0),p(40,20),p(0,20),p(0,0)];
const segments=rectangle.slice(1).map((end,index)=>({kind:'line' as const,start:rectangle[index],end}));
const run=(z:number):CanonicalToolpathRun=>({kind:'cut',z,points:rectangle.map(point=>({...point})),segments:segments.map(segment=>({kind:'line' as const,start:{...segment.start},end:{...segment.end}})),retractAfter:true});
const base:CanonicalToolpath={version:1,operationKind:'contour',strategy:'contour',tool:{diameterMm:3},stepoverPercent:0,runs:[run(-.5),run(-1)]};

const autoOperation:ContourOperation={...defaultContourOperation,id:'rw6-auto',contourId:0,contourIds:[0],startMode:'auto',entryMode:'plunge',totalDepthMm:1,stepDownMm:.5};
const auto=applyContourStartPlacement(base,autoOperation);

const manualOperation:ContourOperation={...autoOperation,id:'rw6-manual',startMode:'manual',startFraction:.5};
const manual=applyContourStartPlacement(base,manualOperation);

const rampOperation:ContourOperation={...manualOperation,id:'rw6-ramp',entryMode:'ramp',rampAngleDeg:3,safeZMm:5,plungeMmMin:200};
const rampPlaced=applyContourStartPlacement(base,rampOperation);
const ramp=rampPlaced.errors.length?{toolpath:rampPlaced.toolpath,errors:rampPlaced.errors,warnings:rampPlaced.warnings}:applyContourEntry(rampPlaced.toolpath,rampOperation);
const safe=ramp.errors.length?null:materializeSafeMotionChain({toolpath:ramp.toolpath,safeZMm:rampOperation.safeZMm});

const impossibleOperation:ContourOperation={...manualOperation,id:'rw6-impossible',entryMode:'ramp',rampAngleDeg:.1,totalDepthMm:3,stepDownMm:3};
const impossiblePlaced=applyContourStartPlacement({ ...base, runs:[run(-3)] },impossibleOperation);
const impossible=impossiblePlaced.errors.length?{toolpath:impossiblePlaced.toolpath,errors:impossiblePlaced.errors,warnings:impossiblePlaced.warnings}:applyContourEntry(impossiblePlaced.toolpath,impossibleOperation);

console.log(JSON.stringify({
  auto:{errors:auto.errors,warnings:auto.warnings,fraction:auto.fraction,start:auto.toolpath.runs[0]?.points[0]??null},
  manual:{errors:manual.errors,fraction:manual.fraction,starts:manual.toolpath.runs.map(item=>item.points[0])},
  ramp:{errors:ramp.errors,warnings:ramp.warnings,entries:ramp.toolpath.runs.map(item=>item.entrySegments??[]),safeOk:safe?.ok??false,safeErrors:safe?.errors??[],motions:safe?.toolpath?.motions??[]},
  impossible:{errors:impossible.errors},
}));
