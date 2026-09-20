import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const need=(s,t,l)=>{if(!s.includes(t))throw new Error(`008H-A19 contract failed: ${l}`);};
const forbid=(s,t,l)=>{if(s.includes(t))throw new Error(`008H-A19 contract failed: ${l}`);};

const target=read('src/lib/curvedFaceTarget.ts');
const finishing=read('src/lib/surfaceFinishingOperation.ts');
const roughing=read('src/lib/threeDRoughingOperation.ts');

need(target,'type ProjectedBoundaryEdge','explicit projected-boundary topology missing');
need(target,'function classifyProjectedBoundary','boundary classifier missing');
need(target,'verticalBoundaryCandidates','vertical/XY-degenerate candidates must be retained for proof');
need(target,'boundaryEdges','regular projected triangles must expose outer boundary edges');
need(target,'candidateOnProjectedBoundary','degenerate candidates must be proven against projected outer boundary');
need(target,'projectedCandidateExtent','degenerate candidate projected extent must be explicit');
need(target,'segmentCoveredByProjectedBoundary','full projected candidate segment coverage proof missing');
need(target,'Every open interval must be covered','boundary proof must cover intervals, not vertices only');
need(target,'endpoint-only coincidence is insufficient','endpoint-only boundary coincidence must not qualify');
need(target,'liegt nicht nachweisbar auf der äußeren XY-Boundary','unproven/internal degeneration must fail closed');
need(target,'if(Math.abs(hit-z)>1e-4)return null','runtime XY/Z ambiguity must remain fail closed');
need(target,'nicht eindeutig als Z(x,y) definiert','construction-time XY/Z ambiguity proof must remain');
need(target,'spatialIndex=buildSpatialIndex(triangles,bounds)','spatial index must remain based on regular projected triangles');
need(finishing,'buildThreeDSurfaceTargetState','3D finishing must continue using shared Surface Truth');
need(roughing,'buildThreeDSurfaceTargetState','3D roughing must continue using shared Surface Truth');

for(const bad of [
  "if(Math.abs(area2(a,b,c))<=EPS){\n      continue;",
  "Math.max(hit,z)",
  "Math.min(hit,z)",
  "ballnoseContactAt(target",
  "return points.every(point=>boundaryEdges.some",
])forbid(target,bad,`forbidden Surface Truth shortcut: ${bad}`);

console.log('008H-A19 vertical-boundary Surface Truth contract PASS');
