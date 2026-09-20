import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A16 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A16 contract failed: ${l}`);};

const reach=read('src/lib/flatEndCutterReachability.ts');
const a3=read('src/lib/endMillRoughingSafety.ts');
const a4=read('src/lib/threeDRoughingLevelEligibility.ts');
const a6=read('src/lib/threeDRoughingSafeChains.ts');

need(reach,'export function flatEndCutterReachabilityAt','explicit flat-end reachability truth missing');
need(reach,'const targetZ=curvedFaceTargetZAt(target,x,y)','target surface truth must remain explicit');
need(reach,'partSafetyUpperZAt(partSafety,x+dx,y+dy)','complete part truth must protect the cutter footprint');
need(reach,'const reachableFloorZ=protectedMaxZ+finishAllowanceMm','reachable floor must include finish allowance');
need(a3,'flatEndCutterReachabilityAt(','A3 must adapt the A16 reachability truth');
need(a3,'safeZ:reachability.reachableFloorZ','A3 safeZ must be the cutter reachable floor');
need(a4,'cutZ+EPS>=safety.safety.safeZ','A4 must never cut below the reachable floor');
need(a4,'Reachability Z ${cutZ.toFixed(3)}: TARGET ${minTargetZ.toFixed(3)}…${maxTargetZ.toFixed(3)} · FLOOR ${minReachableZ.toFixed(3)}…${maxReachableZ.toFixed(3)}.','target/floor diagnostics missing');
need(a6,'endMillRoughingSafetyAt(target,partSafety,x,y,cutterRadiusMm,finishAllowanceMm)','A6 must re-prove edges through the same A16/A3 truth');

for(const source of [reach,a3,a4,a6])for(const bad of ['Math.min(cutZ','safeZ=cutZ','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt'])forbid(source,bad,`unsafe or forbidden shortcut ${bad}`);
console.log('008H-A16 flat-end cutter reachability contract PASS');
