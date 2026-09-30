import { constructAssumedDiskFromCanonicalRun } from '../../src/lib/trochoidalCanonicalSeed';
import { proveAssumedSeedClearance } from '../../src/lib/trochoidalSeedClearance';
import type { CanonicalToolpath } from '../../src/lib/canonicalToolpath';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const center = { x: 5, y: -3 }, east = { x: 6, y: -3 }, west = { x: 4, y: -3 };
const previous: CanonicalToolpath = { version: 1, operationKind: 'contour', strategy: 'contour',
  tool: { diameterMm: 6 }, stepoverPercent: 0, sourceOperationId: 'prior-contour',
  runs: [{ kind: 'cut', z: -2, points: [east, west, east], segments: [
    { kind: 'arc', start: east, end: west, center, ccw: true },
    { kind: 'arc', start: west, end: east, center, ccw: true }
  ] }] };
const derived = constructAssumedDiskFromCanonicalRun(previous, 0);
expect(derived.ok, `native canonical history geometry: ${derived.errors.join('; ')}`);
if (derived.ok) {
  expect(derived.sourceOperationId === 'prior-contour' && derived.runIndex === 0,
    'conditional source identity is carried through');
  expect(Math.abs(derived.disk.radiusMm - (4-1e-6)) < 1e-12 && derived.disk.clearedToDepthMm === 2,
    'radius comes from canonical tool and depth from canonical run');
  expect(proveAssumedSeedClearance(derived.disk,
    [{ kind: 'line', start: {x:4,y:-3}, end: {x:6,y:-3} }], 1, 1).ok,
    'derived disk composes with E5B');
}
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, tool: { diameterMm: 2 } }, 0).ok,
  'undersized previous cutter leaves a central hole');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, sourceOperationId: '' }, 0).ok,
  'anonymous operation is rejected');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, runs: [{ ...previous.runs[0], z: 0 }] }, 0).ok,
  'no negative cutting depth');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, runs: [{ ...previous.runs[0],
  points: [east, east, east] }] }, 0).ok, 'points cannot contradict native arcs');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, runs: [{ ...previous.runs[0],
  segments: undefined }] }, 0).ok, 'tessellated-only run is rejected');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, runs: [{ ...previous.runs[0],
  segments: [null, previous.runs[0].segments![1]] as unknown as NonNullable<typeof previous.runs[0]['segments']> }] }, 0).ok,
  'malformed native arc fails closed');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, runs: [{ ...previous.runs[0],
  cutSegments3: [{ kind: 'line3', start: { ...east, z: -2 }, end: { ...west, z: -2 } }] }] }, 0).ok,
  'spatial cut override requires independent authority');
expect(!constructAssumedDiskFromCanonicalRun({ ...previous, motions: [
  { kind: 'rapid3', start: { ...east, z: 5 }, end: { ...west, z: 5 } }
] }, 0).ok, 'conflicting machine-motion authority rejected');
expect(!constructAssumedDiskFromCanonicalRun(previous, 1).ok, 'missing run rejected');
console.log('010-E5D canonical conditional seed: PASS');
