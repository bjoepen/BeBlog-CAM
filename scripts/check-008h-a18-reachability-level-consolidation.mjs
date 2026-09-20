import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A18 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A18 contract failed: ${l}`);};

const schedule=read('src/lib/threeDRoughingReachabilityLevelSchedule.ts');
const pipeline=read('src/lib/threeDRoughingPipeline.ts');
const a4=read('src/lib/threeDRoughingLevelEligibility.ts');
const a6=read('src/lib/threeDRoughingSafeChains.ts');

need(schedule,'THREE_D_ROUGHING_REACHABILITY_LEVEL_FRACTION=.125','deterministic consolidation fraction missing');
need(schedule,'Math.max(.01,operation.stepDownMm*THREE_D_ROUGHING_REACHABILITY_LEVEL_FRACTION)','vertical consolidation quantum must derive from step-down with a stable floor');
need(schedule,'Math.floor((depth+EPS)/quantumMm)*quantumMm','reachability floors must be rounded conservatively upward');
need(schedule,'Math.max(bottomZ,conservativeLevelAtOrAbove(floor,topZ,quantumMm))','consolidation must preserve A8 bottom');
need(schedule,'if(consolidatedFloor<topZ-EPS)candidates.add(key(consolidatedFloor))','only constant consolidated candidate levels may be proposed');
need(pipeline,'for(const cutZ of reachabilitySchedule.levels)','all consolidated candidates must traverse normal pipeline');
need(a4,'cutZ+EPS>=safety.safety.safeZ','A4 must remain final point eligibility authority');
need(a6,'from.cutZ+EPS<safety.safety.safeZ','A6 must remain final segment safety authority');

for(const source of [schedule,pipeline])for(const bad of ['Math.ceil((depth','safeZ=cutZ','state:\'removable\'','RoughingRegion','buildPlanarRasterChains','ballnoseContactAt'])forbid(source,bad,`unsafe consolidation shortcut: ${bad}`);
console.log('008H-A18 reachability level consolidation contract PASS');
