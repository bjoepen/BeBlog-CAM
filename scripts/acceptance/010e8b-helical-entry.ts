import { buildAssumedSeedRamp } from '../../src/lib/trochoidalRampEntry';
const expect=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg)};
const disk={center:{x:0,y:0},radiusMm:6,clearedToDepthMm:3};
const endpoint={x:2,y:0};
const ramp=buildAssumedSeedRamp(disk,endpoint,3,{startDepthMm:0,targetDepthMm:3,maximumAngleDeg:3,feedMmMin:120});
expect(ramp.ok,'3 mm / 3 degree protected helix: '+ramp.errors.join(' '));
if(!ramp.ok)throw new Error('unreachable');
expect(ramp.segments.length===ramp.turnCount*2,'two canonical half arcs per turn');
expect(ramp.segments.every(s=>s.kind==='arc3'),'entry contains arc3 only');
expect(ramp.actualAngleDeg<=3+1e-9,'actual ramp angle exceeds 3 degrees');
expect(ramp.xyLengthMm>=3/Math.tan(3*Math.PI/180),'XY length does not satisfy angle');
let previousZ=0;
for(const s of ramp.segments){
  expect(s.start.z<=previousZ+1e-9&&s.end.z<s.start.z+1e-9,'Z must descend monotonically');
  previousZ=s.end.z;
}
const first=ramp.segments[0],last=ramp.segments[ramp.segments.length-1];
expect(Math.hypot(first.start.x-endpoint.x,first.start.y-endpoint.y)<1e-8,'helix starts at requested apex');
expect(Math.hypot(last.end.x-endpoint.x,last.end.y-endpoint.y)<1e-8,'helix ends at requested apex');
expect(Math.abs(last.end.z+3)<1e-9,'helix ends at exact target Z');
expect(ramp.turnCount>1,'3 mm / 3 degree case must use multiple turns, not a single plunge-like circle');

const tenMm=buildAssumedSeedRamp(
  {center:{x:0,y:0},radiusMm:6,clearedToDepthMm:10},
  {x:3-1e-5,y:0},
  3,
  {startDepthMm:0,targetDepthMm:10,maximumAngleDeg:3,feedMmMin:120}
);
expect(tenMm.ok,'10 mm non-binary pitch helix must build: '+tenMm.errors.join(' '));
if(tenMm.ok) {
  expect(tenMm.turnCount===11,'10 mm / 3 degree reference uses eleven turns');
  expect(tenMm.segments.at(-1)!.end.z===-10,'final helix Z is canonicalized to exact target depth');
  for(let i=1;i<tenMm.segments.length;i++)
    expect(JSON.stringify(tenMm.segments[i-1].end)===JSON.stringify(tenMm.segments[i].start),
      'non-binary pitch helix remains bit-exact XYZ-continuous');
}
console.log('010-E8B protected helical startup: PASS', {turns:ramp.turnCount,xyLengthMm:ramp.xyLengthMm,actualAngleDeg:ramp.actualAngleDeg});
