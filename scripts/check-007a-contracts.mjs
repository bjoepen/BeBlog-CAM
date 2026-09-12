import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const projection=read('src/lib/surfaceCarveProjection.ts');
const carve=read('src/lib/carveCanonicalToolpath.ts');
const safe=read('src/lib/safeMotionChain.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const post=read('src/lib/postprocessors.ts');
const fail=message=>{console.error(`007A contract FAIL: ${message}`);process.exit(1)};

if(!projection.includes("curvedFaceTargetZAt"))fail('projection adapter does not use the existing STEP Z(x,y) target contract.');
if(!projection.includes("operationKind!=='carve'"))fail('projection adapter does not reject non-carve geometry.');
if(!projection.includes('verlässt die ausgewählte STEP-Fläche'))fail('outside-face projection does not fail closed.');
if(!projection.includes('sampleSpacingMm'))fail('projection does not expose deterministic preview sampling.');
if(projection.includes('materializeSafeMotionChain'))fail('007A must not materialize Safe Motion.');
if(projection.includes('generateJobGcode')||projection.includes('postprocessors'))fail('007A must not generate or postprocess NC.');
if(carve.includes('surfaceCarveProjection')||carve.includes('curvedFaceTargetZAt'))fail('existing carve canonical kernel was coupled to surface projection.');
if(safe.includes('surfaceCarveProjection')||preflight.includes('surfaceCarveProjection')||gcode.includes('surfaceCarveProjection')||post.includes('surfaceCarveProjection'))fail('007A leaked into the protected motion/NC pipeline.');

console.log('007A contract PASS: STEP surface-carve projection is an isolated preview adapter over existing carve geometry and CurvedFaceTarget; CAM kernel, 004T, preflight, NC and postprocessors remain untouched.');
