import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL 008A: ${message}`);
    process.exitCode = 1;
  }
};

const types = read('src/lib/types.ts');
const preflight = read('src/lib/jobPreflight.ts');
const post = read('src/lib/postprocessors.ts');
const safeMotion = read('src/lib/safeMotionChain.ts');
const packageJson = JSON.parse(read('package.json'));

const productionKinds = [
  'facing',
  'contour',
  'pocket',
  'carve',
  'drill',
  'z-level-roughing',
  'surface-finishing',
];

for (const kind of productionKinds) {
  assert(types.includes(`'${kind}'`), `production operation kind missing: ${kind}`);
  assert(preflight.includes(`operation.kind==='${kind}'`) || (kind === 'contour' && preflight.includes("summary.kind==='step'")), `Preflight coverage missing: ${kind}`);
}

assert(preflight.includes('materializeSafeMotionChain'), 'Preflight must materialize 004T safe motion.');
assert(preflight.includes('validateCanonicalToolpath'), 'Preflight must validate canonical toolpaths.');
assert(safeMotion.includes('buildJobSafeTransitions'), 'job-level safe transitions must remain available.');
assert(post.includes("'grbl'|'estlcam'|'linuxcnc'"), 'postprocessor identities changed unexpectedly.');
assert(post.includes('postProcessEstlcam'), 'Estlcam production postprocessor missing.');
assert(post.includes('Geometry and machine motions are never reconstructed here'), 'Estlcam syntax-only boundary is no longer explicit.');
assert(packageJson.scripts?.['native:build'] === 'bash scripts/build-macos-native-app.sh', 'native:build must remain the production macOS entry point.');

if (!process.exitCode) {
  console.log('PASS 008A production acceptance baseline');
  console.log(`  production operations: ${productionKinds.join(', ')}`);
  console.log('  canonical + 004T preflight: protected');
  console.log('  Estlcam syntax-only postprocessor boundary: protected');
  console.log('  native macOS build entry point: protected');
}
