import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/threeDAnalyticSingularity.ts',import.meta.url),'utf8');
const state=fs.readFileSync(new URL('../src/lib/threeDSurfaceTargetState.ts',import.meta.url),'utf8');
const classifier=fs.readFileSync(new URL('../src/lib/threeDDegeneracyClassification.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const {proveAnalyticSpherePole}=mod;
const assert=(condition,message)=>{if(!condition)throw new Error(`008H-A24-A7 contract failed: ${message}`);};

const candidate=(z=10)=>({faceId:0,triangleIndex:321,triangle:{a:{x:0,y:0,z},b:{x:0,y:0,z},c:{x:1,y:0,z:9}}});
const sphere={center:{x:0,y:0,z:0},axisDirection:{x:0,y:0,z:1},radiusMm:10};

const poleProof=proveAnalyticSpherePole(candidate(),sphere);
assert(poleProof?.kind==='surface-singularity','candidate collapsed at exactly one analytic sphere pole must produce a singularity proof');
assert(poleProof.authority==='analytic-sphere-pole','proof authority must be the analytic BRep sphere pole');
assert(poleProof.candidate.faceId===0&&poleProof.candidate.triangleIndex===321,'proof must retain exact display candidate identity');
assert(poleProof.singularityPoint.z===10,'proof must retain the analytically derived pole');

assert(proveAnalyticSpherePole(candidate(5),sphere)===null,'XY-degenerate sphere candidate away from both analytic poles must remain unproven');
assert(proveAnalyticSpherePole(candidate(),{...sphere,radiusMm:0})===null,'invalid sphere radius must fail closed');
assert(proveAnalyticSpherePole(candidate(),{...sphere,axisDirection:{x:0,y:0,z:2}})===null,'non-unit sphere axis must fail closed');

assert(state.includes("face||face.kind!=='sphere'"),'only a native sphere face may enter the sphere proof path');
assert(state.includes('proveAnalyticSpherePole(candidate,{'),'manufacturing state must consume analytic sphere authority');
assert(!state.includes('!edge?.degenerated||!edge.degeneratedPoint'),'native degenerated edge must not remain a mandatory sphere-pole gate');
assert(classifier.includes("authority:'analytic-sphere-pole'"),'singularity proof type must expose its analytic authority');

console.log('008H-A24-A7 analytic surface singularity authority PASS');
