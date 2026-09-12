import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const surface=read('src/lib/surfaceCarveCanonicalToolpath.ts');
const projection=read('src/lib/surfaceCarveProjection.ts');
const safe=read('src/lib/safeMotionChain.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const post=read('src/lib/postprocessors.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const fail=message=>{console.error(`007B contract FAIL: ${message}`);process.exit(1)};

if(!surface.includes('projectCarveToolpathToSurface'))fail('007B does not reuse the proven 007A projection adapter.');
if(!surface.includes("operationKind:'carve'"))fail('007B must stay inside the existing canonical Carve operation kind.');
if(!surface.includes("strategy:'carve'"))fail('007B must stay inside the existing canonical Carve strategy.');
if(!surface.includes('cutSegments3'))fail('007B does not expose surface-following canonical XYZ cut segments.');
if(!surface.includes('motions'))fail('007B does not emit an explicit canonical machine-motion chain.');
if(!surface.includes("kind:'rapid3'"))fail('007B does not emit explicit safe rapid transitions.');
if(!surface.includes('options.safeZMm'))fail('007B safe transitions are not anchored to the operation safe Z.');
if(!surface.includes('relativeDepthMm=sourceRun.z'))fail('007B does not preserve the existing planar Carve depth as a local surface-relative depth.');
if(!surface.includes('point.z-origin.z+relativeDepthMm'))fail('007B does not convert projected world Z back to WCS plus local Carve depth.');
if(!surface.includes('point.x+origin.x')||!surface.includes('point.y+origin.y'))fail('007B does not transform canonical WCS XY into STEP world coordinates before projection.');
if(surface.includes('materializeSafeMotionChain'))fail('007B core adapter must not call 004T internally; preflight owns 004T validation/materialization.');
if(surface.includes('generateJobGcode')||surface.includes('postprocessors'))fail('007B core adapter must not generate or postprocess NC.');
if(!projection.includes('curvedFaceTargetZAt'))fail('007A projection contract unexpectedly changed.');
if(safe.includes('surfaceCarveCanonicalToolpath')||preflight.includes('surfaceCarveCanonicalToolpath')||gcode.includes('surfaceCarveCanonicalToolpath')||post.includes('surfaceCarveCanonicalToolpath'))fail('007B has been wired into protected production paths before its own acceptance gate.');
if(canonical.includes('surface-carve'))fail('007B must not expand the canonical operation/strategy vocabulary.');

console.log('007B contract PASS: projected Carve geometry becomes canonical XYZ cuts plus explicit safe motions without changing canonical vocabulary, 004T, preflight, NC or postprocessors.');
