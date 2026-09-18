import fs from 'node:fs';

const required = [
  ['src/lib/zLevelPerformance.ts', ['triangleTests','rasterSafetyTests','boundarySegmentDistanceTests','stayDownSafetyTests','accessibilitySamples','accessibilityRegionTests']],
  ['src/lib/zLevelSlice.ts', ['profile?:ZLevelPerformanceProfile','profile.triangleTests++']],
  ['src/lib/planarRasterKernel.ts', ['profile?:ZLevelPerformanceProfile','profile.rasterSafetyTests++','profile.boundarySegmentDistanceTests++','profile.stayDownSafetyTests++']],
  ['src/lib/modelRoughingToolpath.ts', ['profile?:ZLevelPerformanceProfile','buildPlanarRasterChains(loops,toolDiameterMm,stepoverPercent,profile)']],
  ['src/lib/modelRoughingOperation.ts', ['profile?:ZLevelPerformanceProfile','profile.accessibilitySamples++','profile.accessibilityRegionTests++','sliceTrianglesAtZ(part,z,profile)']],
  ['src/lib/zLevelOperationState.ts', ['profile?:ZLevelPerformanceProfile','buildModelRoughingOperationState(args)']],
  ['src/lib/activeCanonicalToolpath.ts', ['buildActiveCanonicalToolpathProfiled','zLevelPerformanceProfile:profile']],
];

for (const [path, needles] of required) {
  const text = fs.readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) throw new Error(`008E profiling contract: ${path} missing ${needle}`);
  }
}

const forbidden = [
  ['src/lib/zLevelPerformance.ts', ['Date.now','performance.now','console.time']],
];
for (const [path, needles] of forbidden) {
  const text = fs.readFileSync(path, 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) throw new Error(`008E deterministic gate: ${path} contains ${needle}`);
  }
}

console.log('008E profiling contract PASS');
