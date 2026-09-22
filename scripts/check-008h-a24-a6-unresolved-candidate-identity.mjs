import fs from 'node:fs';
import ts from 'typescript';

const classifierSource=fs.readFileSync(new URL('../src/lib/threeDDegeneracyClassification.ts',import.meta.url),'utf8');
const targetSource=fs.readFileSync(new URL('../src/lib/curvedFaceTarget.ts',import.meta.url),'utf8');
const js=ts.transpileModule(classifierSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const {classifyProvenDegeneracy,degeneracyResultMatchesCandidate,degeneracyProofMatchesResult}=mod;

const assert=(condition,message)=>{if(!condition)throw new Error(`008H-A24-A6 contract failed: ${message}`);};
const candidate={faceId:0,triangleIndex:321};
const other={faceId:0,triangleIndex:320};
const points=[{x:0,y:0,z:10},{x:0,y:0,z:10},{x:1,y:0,z:9}];
const boundary={kind:'boundary',candidate:{...candidate},candidatePoints:points,wireId:4,edgeId:7};
const singularity={kind:'surface-singularity',candidate:{...candidate},candidatePoints:points,edgeId:8,degeneratedPoint:{x:0,y:0,z:10}};

const unresolved=classifyProvenDegeneracy(candidate,[]);
assert(unresolved.classification==='UNRESOLVED','zero-proof candidate must remain UNRESOLVED');
assert(unresolved.proof===null,'UNRESOLVED must retain no arbitrary proof');
assert(degeneracyResultMatchesCandidate(unresolved,candidate),'UNRESOLVED result must retain candidate identity');
assert(degeneracyProofMatchesResult(unresolved),'proof:null must not become a false identity mismatch');

const boundaryResult=classifyProvenDegeneracy(candidate,[boundary]);
assert(boundaryResult.classification==='BOUNDARY','single boundary proof must remain BOUNDARY');
assert(degeneracyResultMatchesCandidate(boundaryResult,candidate)&&degeneracyProofMatchesResult(boundaryResult),'BOUNDARY result and proof identities must match');

const singularityResult=classifyProvenDegeneracy(candidate,[singularity]);
assert(singularityResult.classification==='SURFACE_SINGULARITY','single singularity proof must remain SURFACE_SINGULARITY');
assert(degeneracyResultMatchesCandidate(singularityResult,candidate)&&degeneracyProofMatchesResult(singularityResult),'SURFACE_SINGULARITY result and proof identities must match');

const wrongResult={...unresolved,candidate:{...other}};
assert(!degeneracyResultMatchesCandidate(wrongResult,candidate),'wrong result identity must fail closed');

const wrongProofResult={...boundaryResult,proof:{...boundary,candidate:{...other}}};
assert(!degeneracyProofMatchesResult(wrongProofResult),'wrong proof identity must fail closed independently');

const competing=classifyProvenDegeneracy(candidate,[boundary,singularity]);
assert(competing.classification==='UNRESOLVED'&&competing.proof===null,'competing proofs must remain UNRESOLVED');
assert(degeneracyResultMatchesCandidate(competing,candidate),'competing-proof UNRESOLVED must retain candidate identity');
assert(competing.reason.includes('Mehrere konkurrierende Degeneracy-Beweise'),'competing-proof reason must remain observable');

assert(targetSource.includes('classification&&!resultIdentityMatches'),'Surface Truth must reject a mismatched result identity');
assert(targetSource.includes('classification&&!proofIdentityMatches'),'Surface Truth must reject a mismatched proof identity separately');
assert(targetSource.includes("classification&&resultIdentityMatches&&proofIdentityMatches&&(classification.classification==='BOUNDARY'||classification.classification==='SURFACE_SINGULARITY')&&classification.proof"),'only accepted classes with consistent result/proof identity and a concrete proof may be excluded');

console.log('008H-A24-A6 unresolved candidate identity integrity PASS');
