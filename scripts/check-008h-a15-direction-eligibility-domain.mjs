import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(\`../\${path}\`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(\`008H-A15 contract failed: \${l}\`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(\`008H-A15 contract failed: \${l}\`);};

const types=read('src/lib/types.ts');
const safety=read('src/lib/endMillRoughingSafety.ts');
const eligibility=read('src/lib/threeDRoughingLevelEligibility.ts');
const connectivity=read('src/lib/threeDRoughingMaterialConnectivity.ts');
const chains=read('src/lib/threeDRoughingSafeChains.ts');
const pipeline=read('src/lib/threeDRoughingPipeline.ts');
const ui=read('src/App.svelte');
const summary=read('src/lib/operationsProject.ts');

need(types,"direction?:'x'|'y'","3D roughing operation direction missing");
need(types,"finishAllowanceMm:.5,direction:'x'","new 3D roughing operations must default to X");
need(safety,"EndMillRoughingSafetyStatus='safe'|'outside-target'|'unresolved'","A3 status taxonomy missing");
need(safety,"status:'outside-target'","outside target must not be reported as unresolved safety");
need(eligibility,"'removable'|'protected'|'outside-target'|'unresolved'","A4 four-state domain missing");
need(eligibility,"safety.status==='outside-target'","A4 must preserve outside-target explicitly");
need(eligibility,'OUTSIDE_TARGET \${outsideTargetCount} · UNRESOLVED \${unresolvedCount}','eligibility diagnostic counts missing');
need(connectivity,"sample.state==='removable'","A5 must still connect REMOVABLE only");
need(connectivity,'OUTSIDE_TARGET-Sample','A5 must report outside-target as non-machining domain');
need(chains,"direction:'x'|'y'='x'","A6 direction contract missing");
need(chains,"direction==='x'","A6 must choose one orthogonal edge orientation only");
need(pipeline,"operation.direction??'x'","legacy operations must deterministically fall back to X");
need(ui,"updateThreeDRoughing({direction:'x'})","Parallel X UI control missing");
need(ui,"updateThreeDRoughing({direction:'y'})","Parallel Y UI control missing");
need(summary,"(operation.direction??'x')==='x'?'Parallel X':'Parallel Y'","operation summary direction missing");

for(const source of [safety,eligibility,connectivity,chains,pipeline])for(const bad of ['RoughingRegion','buildPlanarRasterChains','ballnoseContactAt'])forbid(source,bad,\`forbidden geometry shortcut \${bad}\`);
console.log('008H-A15 roughing direction and eligibility-domain contract PASS');
