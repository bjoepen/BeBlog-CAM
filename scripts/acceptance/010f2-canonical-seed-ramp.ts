import { buildCanonicalSeedTrochoidRampReference } from '../../src/lib/trochoidalCanonicalRamp';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import { constructAssumedDiskFromCanonicalRun } from '../../src/lib/trochoidalCanonicalSeed';
import { buildProtectedTrochoidRampReference } from '../../src/lib/trochoidalRampEntry';
import type { CanonicalToolpath } from '../../src/lib/canonicalToolpath';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const context={sourceFrameId:'setup-1',targetFrameId:'setup-1',sourceOperationIndex:0,
  targetOperationIndex:1,targetOperationId:'trochoid-1'};
const ramp={startDepthMm:0,targetDepthMm:1,maximumAngleDeg:3,feedMmMin:180};
const shapes:Curve2[][]=[[{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]];
for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const ccw of [false,true]) {
  const built=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>({x:p.x+12,y:p.y-7}));
  if(!built.ok)throw new Error('guide');
  const guide=built.guide,loop={radiusMm:4,forwardStepMm:.5,loopDirection:ccw?'ccw' as const:'cw' as const};
  const eligible=assessTrochoidalGuideEligibility(guide,4,.5);
  if(!eligible.ok)throw new Error('eligible');
  const path=buildSemanticTrochoid(guide.segments,{...loop,freeSide:eligible.freeSide});
  if(!path.ok || path.segments[0].kind!=='arc')throw new Error('path');
  const center={...path.segments[0].center};
  const makePrior=(radius=3.5,toolRadius=3.6):CanonicalToolpath=>{
    const east={x:center.x+radius,y:center.y},west={x:center.x-radius,y:center.y};
    return {version:1,operationKind:'contour',strategy:'contour',tool:{diameterMm:2*toolRadius},
      stepoverPercent:0,sourceOperationId:'seed-source',runs:[{kind:'cut',z:-2,points:[east,west,east],
        segments:[{kind:'arc',start:east,end:west,center:{...center},ccw},
          {kind:'arc',start:west,end:east,center:{...center},ccw}]}]};
  };
  const prior=makePrior();
  const assess=(source=prior,ctx=context,runIndex=0,rampOptions=ramp)=>
    buildCanonicalSeedTrochoidRampReference(source,runIndex,ctx,guide,loop,3,140,rampOptions);
  const before=JSON.stringify({prior,context,guide,loop,ramp});
  const result=assess();
  expect(result.ok,`${side} canonical source: ${result.errors.join(' ')}`);
  if(result.ok) {
    expect(result.source.operationId==='seed-source' && result.source.runIndex===0
      && result.source.frameId==='setup-1' && result.source.operationIndex===0,'source trace retained');
    expect(Math.abs(result.source.disk.radiusMm-7.099999)<1e-10
      && Math.abs(result.source.footprintRadiusMm-7.1)<1e-10,'derived reserve and full source footprint distinguished');
    expect(result.source.disk.clearedToDepthMm===2,'depth from source cut');
    const end=result.reference.ramp.segments.at(-1)!.end;
    expect(end.x===path.segments[0].start.x && end.y===path.segments[0].start.y && end.z===-1,'combined continuity');
  }
  expect(before===JSON.stringify({prior,context,guide,loop,ramp}),'inputs unchanged');
  for(const ctx of [{...context,targetFrameId:'setup-2'},{...context,sourceFrameId:''},
    {...context,sourceOperationIndex:1},{...context,targetOperationIndex:-1},
    {...context,targetOperationId:'seed-source'},{...context,targetOperationId:' seed-source '}])expect(!assess(prior,ctx).ok,'invalid frame/order/self source rejected');
  expect(!assess({...prior,sourceOperationId:''}).ok,'anonymous source rejected');
  expect(!assess(prior,context,1).ok,'missing source run rejected');
  expect(!assess(prior,context,0,{...ramp,targetDepthMm:3}).ok,'source depth is insufficient');
  expect(!assess({...prior,tool:{diameterMm:2}}).ok,'central-hole source rejected');
  expect(!assess({...prior,runs:[{...prior.runs[0],points:[] }]}).ok,'forged canonical points rejected');
  expect(!assess({...prior,motions:[{kind:'rapid3',start:{...center,z:5},end:{...center,z:0}}]}).ok,'alternative motion authority rejected');
  const overlapping=assess(makePrior(4,5));
  expect(!overlapping.ok && overlapping.reference===null && overlapping.source===null,'overlapping source footprint rejected atomically');
  const nearPart=makePrior(3.5,3.6999905);
  const reducedSeed=constructAssumedDiskFromCanonicalRun(nearPart,0);
  if(!reducedSeed.ok)throw new Error('near-part seed');
  expect(buildProtectedTrochoidRampReference(guide,loop,reducedSeed.disk,3,140,ramp).ok,
    'reserved derived seed passes protection by itself');
  expect(!assess(nearPart).ok,'full source footprint has insufficient reserve even when the derived seed passes');
  const steep=assess(prior,context,0,{...ramp,maximumAngleDeg:1e-9});
  expect(!steep.ok && steep.reference===null && steep.source===null,'ramp failure discards source and candidate');
}
console.log('010-F2 canonical seed ramp reference: PASS');
