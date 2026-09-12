import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const projection=read('src/lib/surfaceCarveProjection.ts');
const proof=read('src/lib/surfaceCarveViewProof.ts');
const geometryView=read('src/lib/GeometryView.svelte');
const curvedView=read('src/lib/curvedViewCache.ts');
const carve=read('src/lib/carveCanonicalToolpath.ts');
const safe=read('src/lib/safeMotionChain.ts');
const preflight=read('src/lib/jobPreflight.ts');
const gcode=read('src/lib/jobGcode.ts');
const post=read('src/lib/postprocessors.ts');
const fail=message=>{console.error(`007A contract FAIL: ${message}`);process.exit(1)};

if(!projection.includes('curvedFaceTargetZAt'))fail('projection adapter does not use the existing STEP Z(x,y) target contract.');
if(!projection.includes("operationKind!=='carve'"))fail('projection adapter does not reject non-carve geometry.');
if(!projection.includes('verlässt die ausgewählte STEP-Fläche'))fail('outside-face projection does not fail closed.');
if(!projection.includes('sampleSpacingMm'))fail('projection does not expose deterministic preview sampling.');
if(projection.includes('materializeSafeMotionChain'))fail('007A must not materialize Safe Motion.');
if(projection.includes('generateJobGcode')||projection.includes('postprocessors'))fail('007A must not generate or postprocess NC.');
if(!proof.includes('projectCarveToolpathToSurface'))fail('isolated visual proof does not route through the real projection adapter.');
if(!proof.includes('target.triangles')||!proof.includes('barycentricPoint'))fail('visual proof must be constructed inside real selected STEP triangles, not the target bounding box.');
if(!proof.includes('point.z+.35'))fail('visual proof diagnostic lift must remain rendering-only and visibly separate from the target grid.');
if(proof.includes('materializeSafeMotionChain')||proof.includes('generateJobGcode'))fail('visual proof leaked into machine motion or NC.');
if(curvedView.includes('surfaceCarveProjection')||curvedView.includes('projectCarveToolpathToSurface')||curvedView.includes('buildSurfaceCarveViewProof'))fail('stable curved STEP viewer cache must contain only the established target grid/roughing behavior.');
if(!geometryView.includes("buildSurfaceCarveViewProof"))fail('GeometryView does not consume the isolated 007A visual proof.');
if(!geometryView.includes('surfaceCarveProofPaths'))fail('007A proof does not have a dedicated scene output.');
if(!geometryView.includes('class="surface-carve-proof"'))fail('007A proof does not have a dedicated render class.');
if(carve.includes('surfaceCarveProjection')||carve.includes('curvedFaceTargetZAt'))fail('existing carve canonical kernel was coupled to surface projection.');
if(safe.includes('surfaceCarveProjection')||preflight.includes('surfaceCarveProjection')||gcode.includes('surfaceCarveProjection')||post.includes('surfaceCarveProjection'))fail('007A leaked into the protected motion/NC pipeline.');

console.log('007A contract PASS: STEP surface-carve projection uses a dedicated viewer proof channel while curved STEP cache, CAM kernel, 004T, preflight, NC and postprocessors remain isolated.');
