import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A24-A4 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A24-A4 contract failed: ${l}`);};

const acceptance=read('src/lib/threeDDegeneracyAcceptance.ts');
const state=read('src/lib/threeDSurfaceTargetState.ts');
const target=read('src/lib/curvedFaceTarget.ts');
const classifier=read('src/lib/threeDDegeneracyClassification.ts');
const roughing=read('src/lib/threeDRoughingOperation.ts');
const finishing=read('src/lib/surfaceFinishingOperation.ts');

need(acceptance,'buildThreeDDegeneracyAcceptanceSnapshot','A4 must summarize the exact A3 candidate classifications');
need(acceptance,"BOUNDARY:0",'A4 snapshot must count boundary classifications');
need(acceptance,"SURFACE_SINGULARITY:0",'A4 snapshot must count singularity classifications');
need(acceptance,"INVALID_FOR_HEIGHTFIELD:0",'A4 snapshot must count invalid classifications');
need(acceptance,"UNRESOLVED:0",'A4 snapshot must count unresolved classifications');
need(acceptance,'degeneracyResultMatchesCandidate(classification,{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex})','A4 evidence must recheck result identity independently of proof existence');
need(acceptance,'degeneracyProofMatchesResult(classification)','A4 evidence must recheck proof identity independently');
need(acceptance,"acceptedCount=counts.BOUNDARY+counts.SURFACE_SINGULARITY",'only A24 accepted classes may count as accepted');
need(acceptance,"'[008H-A24-A4][3D-degeneracy-acceptance]'",'real-world evidence must have a stable console marker');
need(acceptance,'surfaceTargetValid:boolean','A4 evidence must include the actual shared Surface Truth outcome');
need(acceptance,'surfaceTargetErrors:string[]','A4 evidence must retain actual Surface Truth rejection reasons');
need(state,'buildThreeDDegeneracyAcceptanceSnapshot(degeneracyCandidates,degeneracyClassifications)','A4 must observe the exact classifications passed to Surface Truth');
need(state,'const target=buildCurvedFaceTarget','A4 must evaluate the authoritative shared target before emitting acceptance evidence');
need(state,'surfaceTargetValid:target.valid&&errors.length===0','A4 PASS evidence must derive from the actual shared Surface Truth result');
need(state,"surfaceTargetErrors:[...new Set(errors)]",'A4 FAIL evidence must preserve the actual shared Surface Truth errors');
need(state,'emitThreeDDegeneracyAcceptanceSnapshot','A4 must expose real-world evidence without a parallel geometry path');
need(state,'buildCurvedFaceTarget(part,displayFaceIds,faceIds,undefined,boundaryGeometry,degeneracyClassifications)','A3 manufacturing integration must remain unchanged');
need(target,"classification&&resultIdentityMatches&&proofIdentityMatches&&(classification.classification==='BOUNDARY'||classification.classification==='SURFACE_SINGULARITY')&&classification.proof",'A3 acceptance gate must remain authoritative');
need(classifier,"proofs.length!==1||!sameCandidate",'competing or mismatched proofs must remain unresolved');
need(roughing,'buildThreeDSurfaceTargetState','roughing must continue to use shared Surface Truth');
need(finishing,'buildThreeDSurfaceTargetState','finishing must continue to use shared Surface Truth');

for(const bad of [
  'CanonicalToolpath',
  'ballnoseContactAt',
  'buildThreeDRoughingCanonicalToolpath',
  'buildSurfaceFinishingCanonicalToolpath',
  "classification==='SURFACE_SINGULARITY'?true",
])forbid(acceptance,bad,`A4 diagnostics must not create manufacturing truth: ${bad}`);

console.log('008H-A24-A4 real-world degeneracy acceptance contract PASS');
