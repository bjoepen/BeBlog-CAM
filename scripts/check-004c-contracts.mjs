import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} 004C: ${message}`);
  if (!condition) process.exitCode = 1;
};

const holes = read('src/lib/stepHoleRecognition.ts');
const features = read('src/lib/stepManufacturingFeatures.ts');
const cpp = read('src-tauri/native/occt_bridge.cpp');

assert(holes.includes("kind: 'hole'"), 'typed STEP hole feature exists');
assert(holes.includes('exact-cylinder-boundaries'), 'recognition exposes conservative confidence');
assert(holes.includes("termination: 'unknown'"), 'blind/through state is not guessed');
assert(holes.includes("circles.length !== 2"), 'cylinder requires exactly two circular boundaries');
assert(holes.includes('edge.kind === \'circle\''), 'recognition consumes exact circle semantics');
assert(holes.includes('Math.abs(edge.radiusMm-face.radiusMm)<=EPS_MM'), 'circle and cylinder radii must match');
assert(holes.includes('parallel(edge.axisDirection, face.axisDirection)'), 'circle and cylinder axes must align');
assert(features.includes('wiresByFace'), 'recognition is based on BRep face/wire topology');
assert(cpp.includes('manufacturingEdges') && cpp.includes('manufacturingWires'), 'native bridge remains the exact topology source');
assert(!holes.includes('buildDrillToolpath') && !holes.includes('helical-mill'), '004C does not generate drilling toolpaths');

if (process.exitCode) process.exit(process.exitCode);
