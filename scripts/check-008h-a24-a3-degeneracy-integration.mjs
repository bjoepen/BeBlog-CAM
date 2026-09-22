import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A3 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A3 contract failed: ${l}`);};
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const classifier=read('src/lib/threeDDegeneracyClassification.ts');
const analytic=read('src/lib/threeDAnalyticSingularity.ts');

need(state,'selectedCurvedFaceDegeneracyCandidates','shared target must expose concrete candidate identity');
need(state,'placedSphereSingularityProofs','singularity proof must be isolated from classifier');
need(state,"face.kind!=='sphere'","sphere semantics are necessary but not sufficient");
need(state,'proveAnalyticSpherePole(candidate,{','sphere singularity must be proven by the dedicated analytic surface authority');
need(state,'center:place(face.center)','sphere center must derive from exact A1 semantics in placed coordinates');
need(state,'axisDirection:{x:face.axisDirection[0],y:face.axisDirection[1],z:face.axisDirection[2]}','sphere axis must derive from exact A1 semantics');
need(state,'radiusMm:face.radiusMm','sphere radius must derive from exact A1 semantics');
need(state,"kind:'surface-singularity'","only the proof producer may emit a singularity proof");
need(state,'provenAnalyticBoundaryForCandidate(candidate,boundaryGeometry)','BOUNDARY must reuse A20/A23 analytic boundary proof');
need(state,"kind:'boundary'","boundary proof must be explicit");
need(state,'classifyProvenDegeneracy(','all candidate evidence must pass through the shared A2b2 classifier');
need(state,'{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex}','classification result must be bound to the concrete display candidate');
need(target,'if(degeneracyClassifications){','manufacturing classifications must disable legacy mesh fallback');
need(target,'degeneracyResultMatchesCandidate(classification,{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex})','classification result must belong to the same display candidate');
need(target,'degeneracyProofMatchesResult(classification)','classification proof identity must be checked independently');
need(target,"classification&&resultIdentityMatches&&proofIdentityMatches&&(classification.classification==='BOUNDARY'||classification.classification==='SURFACE_SINGULARITY')&&classification.proof",'only identity-matched proven boundary or singularity may be excluded from heightfield triangles');
need(target,"classification?.classification??'UNRESOLVED'",'missing classification must fail closed as unresolved');
need(target,"classification.classification",'unresolved/invalid candidates must fail closed');
need(target,'triangleIndex:Math.floor(i/3)','candidate identity must remain tied to display triangle index');
need(target,'if(Math.abs(hit-z)>1e-4)return null','multi-Z runtime fail-closed must remain');
need(classifier,"proofs.length!==1||!sameCandidate",'competing proofs must remain UNRESOLVED');

for(const bad of [
  "face.kind==='sphere')return",
  "edge.degenerated)return",
  "outerBoundary.ok===false){\n      return{ok:false",
])forbid(state,bad,`forbidden shortcut: ${bad}`);

console.log('008H-A24-A3 controlled degeneracy integration contract PASS');
