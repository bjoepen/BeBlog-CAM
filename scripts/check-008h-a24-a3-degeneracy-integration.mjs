import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A3 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A3 contract failed: ${l}`);};
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const classifier=read('src/lib/threeDDegeneracyClassification.ts');

need(state,'selectedCurvedFaceDegeneracyCandidates','shared target must expose concrete candidate identity');
need(state,'placedSphereSingularityProofs','singularity proof must be isolated from classifier');
need(state,"face.kind!=='sphere'","sphere semantics are necessary but not sufficient");
need(state,'source.source.wiresByFace.get(candidate.faceId)','native edge must belong to the same selected face');
need(state,'!edge?.degenerated||!edge.degeneratedPoint','native degenerated edge and A2b1 location are mandatory');
need(state,'center.x+axis.x*face.radiusMm','positive analytic sphere pole must derive from exact A1 semantics');
need(state,'center.x-axis.x*face.radiusMm','negative analytic sphere pole must derive from exact A1 semantics');
need(state,'poles.some(pole=>distance3(point,pole)<=tolerance)','native degenerated location must match an analytic pole');
need(state,'points.filter(vertex=>distance3(vertex,point)<=tolerance).length<2','concrete display candidate must contain the same collapsed location at least twice');
need(state,"kind:'surface-singularity'","only the proof producer may emit a singularity proof");
need(state,'provenAnalyticBoundaryForCandidate(candidate,boundaryGeometry)','BOUNDARY must reuse A20/A23 analytic boundary proof');
need(state,"kind:'boundary'","boundary proof must be explicit");
need(state,'classifyProvenDegeneracy(proofs)','all candidate evidence must pass through the shared A2b2 classifier');
need(target,'if(degeneracyClassifications){','manufacturing classifications must disable legacy mesh fallback');
need(target,'classification?.proof?.candidate.faceId===candidate.faceId','classification proof must belong to the same face');
need(target,'classification?.proof?.candidate.triangleIndex===candidate.triangleIndex','classification proof must belong to the same display triangle');
need(target,"classification&&identityMatches&&(classification.classification==='BOUNDARY'||classification.classification==='SURFACE_SINGULARITY')",'only identity-matched proven boundary or singularity may be excluded from heightfield triangles');
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
