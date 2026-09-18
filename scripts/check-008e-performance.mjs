import fs from 'node:fs';

const required = [
  ['src/lib/zLevelPerformance.ts', ['triangleTests','rasterSafetyTests','boundarySegmentDistanceTests','stayDownSafetyTests','accessibilitySamples','accessibilityRegionTests','curvedTargetTriangleTests','curvedCutterSurfaceTests']],
  ['src/lib/zLevelSlice.ts', ['profile?:ZLevelPerformanceProfile','profile.triangleTests++']],
  ['src/lib/planarRasterKernel.ts', ['profile?:ZLevelPerformanceProfile','profile.rasterSafetyTests++','profile.boundarySegmentDistanceTests++','profile.stayDownSafetyTests++']],
  ['src/lib/modelRoughingToolpath.ts', ['profile?:ZLevelPerformanceProfile','buildPlanarRasterChains(loops,toolDiameterMm,stepoverPercent,profile)']],
  ['src/lib/modelRoughingOperation.ts', ['profile?:ZLevelPerformanceProfile','profile.accessibilitySamples++','profile.accessibilityRegionTests++','sliceTrianglesAtZ(part,z,profile)']],
  ['src/lib/zLevelOperationState.ts', ['profile?:ZLevelPerformanceProfile','buildModelRoughingOperationState(args)','buildFaceTargetOperationState(args)','buildCurvedFaceRoughingOperationState(args)']],
  ['src/lib/faceTargetToolpath.ts', ['profile?:ZLevelPerformanceProfile','buildPlanarRasterChains(target.loops,toolDiameterMm,stepoverPercent,profile)']],
  ['src/lib/curvedFaceTarget.ts', ['profile?:ZLevelPerformanceProfile','profile.curvedTargetTriangleTests++','type CurvedFaceSpatialIndex','buildSpatialIndex','candidateTriangleIndices','spatialIndex=buildSpatialIndex(triangles,bounds)']],
  ['src/lib/curvedFaceRoughing.ts', ['profile?:ZLevelPerformanceProfile','profile.curvedCutterSurfaceTests++']],
  ['src/lib/activeCanonicalToolpath.ts', ['buildActiveCanonicalToolpathProfiled','zLevelPerformanceProfile:profile']],
  ['src/App.svelte', ["import.meta.env.DEV","008E · Performance-Diagnose","createZLevelPerformanceProfile","zLevelPerformanceProfile:profile","zLevel008eProfile","Curved Triangle","Curved Cutter Samples"]],
];

for (const [path, needles] of required) {
  const text = fs.readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) throw new Error(`008E profiling contract: ${path} missing ${needle}`);
  }
}

const app = fs.readFileSync('src/App.svelte', 'utf8');
const editSection = app.slice(app.indexOf("activeCanonicalToolpath=buildOrderedActiveCanonicalToolpath"), app.indexOf("const operationLabel="));
if (editSection.includes("activeFaceTargetOperationState=")) throw new Error('008E single-calculation contract: eager active face-target reconstruction returned');
for (const guard of ["activeStep==='Prüfen'&&importSummary?operationsProject.operations", "activeStep==='Prüfen'&&importSummary?.kind==='step'", "(activeStep==='Prüfen'||activeStep==='Fräsen')&&importSummary?validateJob"]) {
  if (!editSection.includes(guard)) throw new Error(`008E single-calculation contract: missing edit-time guard ${guard}`);
}

const forbidden = [
  ['src/lib/zLevelPerformance.ts', ['Date.now','performance.now','console.time']],
  ['src/App.svelte', ['buildActiveCanonicalToolpathProfiled']],
];
for (const [path, needles] of forbidden) {
  const text = fs.readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) throw new Error(`008E deterministic gate: ${path} contains ${needle}`);
  }
}

console.log('008E profiling contract PASS');
