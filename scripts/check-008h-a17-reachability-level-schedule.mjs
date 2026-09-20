import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A17 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A17 contract failed: ${l}`);};

const a17=read('src/lib/threeDRoughingReachabilityLevelSchedule.ts');
const pipeline=read('src/lib/threeDRoughingPipeline.ts');
const a4=read('src/lib/threeDRoughingLevelEligibility.ts');
const a6=read('src/lib/threeDRoughingSafeChains.ts');

need(a17,'baseSchedule:ThreeDRoughingZLevelSchedule','A8 must remain the base schedule');
need(a17,'flatEndCutterReachabilityAt(','A17 must consume A16 reachability truth');
need(a17,'if(reach.reachableFloorZ>topZ+EPS)continue','levels above stock top must not be proposed');
need(a17,'reachableFloors.push(Math.max(bottomZ,reach.reachableFloorZ))','A17 must not schedule below the A8 bottom');
need(a17,'while(z-operation.stepDownMm>floor+EPS)','candidate descent must respect maximum step-down');
need(a17,'candidates.add(key(floor))','reachable floor must be eligible as a constant candidate level');
need(a17,'.sort((a,b)=>b-a)','candidate levels must be strictly descending after deduplication');
need(pipeline,'buildThreeDRoughingReachabilityLevelSchedule({','A10 must orchestrate A17 after A8');
need(pipeline,'for(const cutZ of reachabilitySchedule.levels)','every A17 candidate must enter the normal A4 pipeline');
need(a4,'cutZ+EPS>=safety.safety.safeZ','A4 remains cut eligibility authority');
need(a6,'from.cutZ+EPS<safety.safety.safeZ','A6 remains segment re-proof authority');

for(const source of [a17,pipeline])for(const bad of ['state:\'removable\'','safeZ=cutZ','Math.min(cutZ','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt','CanonicalToolpathRun'])forbid(source,bad,`A17 must not approve cuts or invent manufacturing geometry: ${bad}`);
console.log('008H-A17 reachability-aware Z-level schedule contract PASS');
