import { buildTrochoidMultiDepthStockEntryReference } from '../../src/lib/trochoidalMultiDepthStockEntry';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const base={allowFullWidthStartup:true,totalDepthMm:2.4,stepDownMm:1,safeZMm:5,rapidFeedMmMin:900,
  maximumRampAngleDeg:3,rampFeedMmMin:180,startupFeedMmMin:120,seedExtraRadiusMm:.1,
  bootstrapStepMm:.5,allowedExposedAngleDeg:140};

const shapes:Curve2[][]=[
  [{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]
];

for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const loopDirection of ['cw','ccw'] as const) {
  const built=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
  if(!built.ok)throw new Error('guide');
  const loop={radiusMm:4,forwardStepMm:.5,loopDirection};
  const before=JSON.stringify({guide:built.guide,loop,base});
  const r=buildTrochoidMultiDepthStockEntryReference(built.guide,loop,3,base);
  expect(r.ok,`${side} multidepth: ${r.errors.join(' ')}`);
  if(!r.ok)continue;
  expect(r.levels.length===3,'three depth levels');
  expect(JSON.stringify(r.levels.map(l=>l.depthMm))===JSON.stringify([1,2,2.4]),'short final step-down');
  expect(JSON.stringify({guide:built.guide,loop,base})===before,'inputs unchanged');

  for(const [i,level] of r.levels.entries()) {
    expect(level.reference.seed.clearedToDepthMm===level.depthMm,'each level rebuilds F3 at absolute depth');
    expect(level.reference.startup.segments[0].start.z===0,'each F3 level starts at stock surface');
    const entry=level.reference.startup.segments[0].start;
    const down=level.approach.at(-1)!;
    expect(down.start.z===5 && down.end.z===0 && down.start.x===entry.x && down.end.x===entry.x
      && down.start.y===entry.y && down.end.y===entry.y,'approach descends vertically from safe Z');
    expect(level.retract.end.z===5 && level.retract.start.z===-level.depthMm
      && level.retract.start.x===level.retract.end.x && level.retract.start.y===level.retract.end.y,
      'retract is vertical to safe Z');
    if(i>0) {
      expect(level.approach.length===2,'later levels have safe-Z lateral plus vertical approach');
      const lateral=level.approach[0];
      expect(lateral.start.z===5 && lateral.end.z===5,'lateral transition only at safe Z');
      expect(JSON.stringify(r.levels[i-1].retract.end)===JSON.stringify(lateral.start),'transition starts at previous retract');
    } else expect(level.approach.length===1,'first level needs no lateral transition');
  }
}

const guideBuilt=buildTrochoidalContourGuide(shapes[0],{...defaultTrochoidalContourContract,contourId:0,side:'outside'});
if(!guideBuilt.ok)throw new Error('guide');
const loop={radiusMm:4,forwardStepMm:.5,loopDirection:'cw' as const};
for(const bad of [{totalDepthMm:0},{stepDownMm:0},{safeZMm:0},{rapidFeedMmMin:0},{stepDownMm:1e-9},
  {allowedExposedAngleDeg:80}]) {
  const r=buildTrochoidMultiDepthStockEntryReference(guideBuilt.guide,loop,3,{...base,...bad});
  expect(!r.ok && r.levels.length===0,'invalid or later unsafe level fails atomically');
}
console.log('010-F4 multi-depth safe transitions: PASS');
