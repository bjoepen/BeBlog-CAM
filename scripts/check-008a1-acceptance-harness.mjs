import {
  acceptanceCase,
  assert,
  assertArcRadiusConsistency,
  assertNcCommandsAllowed,
  assertNoXyRapidBelow,
  assertToolChangeIsStopped,
  dxfSummary,
  drillGeometry,
  ncStats,
  rectangleGeometry,
} from './acceptance/harness.mjs';

acceptanceCase('synthetic rectangle geometry', () => {
  const geometry = rectangleGeometry({ width: 50, height: 30 });
  assert.equal(geometry.curves.length, 4);
  assert.deepEqual(geometry.bounds, { min: { x: 0, y: 0 }, max: { x: 50, y: 30 } });
  const summary = dxfSummary({ geometry });
  assert.equal(summary.kind, 'dxf');
  assert.equal(summary.entities.curves, 4);
});

acceptanceCase('synthetic drill geometry', () => {
  const geometry = drillGeometry({ holes: [[10, 10], [20, 20], [30, 20]] });
  assert.equal(geometry.curves.length, 3);
  assert.ok(geometry.curves.every((curve) => curve.kind === 'circle'));
});

const representativeNc = `
(008A1 harness fixture)
G0 Z5
G0 X0 Y0
M3
G1 Z-1 F100
G1 X10 Y0 F300
G2 X10 Y10 I0 J5
G1 X0 Y10
G1 X0 Y0
G0 Z5
M5
(Werkzeugwechsel Werkzeug 2)
M6
M3
G0 X20 Y20
G1 Z-2 F100
G1 X30 Y20 F300
G0 Z5
M5
`;

acceptanceCase('NC parser and stats', () => {
  const stats = ncStats(representativeNc);
  assert.ok(stats.motionCount >= 10);
  assert.equal(stats.minZ, -2);
  assert.equal(stats.maxZ, 5);
  assert.equal(stats.mCounts.get(6), 1);
});

acceptanceCase('Estlcam-style command subset', () => {
  assertNcCommandsAllowed(representativeNc);
});

acceptanceCase('safe XY rapids', () => {
  assertNoXyRapidBelow(representativeNc, 5);
});

acceptanceCase('tool change spindle stop', () => {
  assertToolChangeIsStopped(representativeNc);
});

acceptanceCase('arc radius consistency', () => {
  assertArcRadiusConsistency(representativeNc);
});

if (!process.exitCode) console.log('PASS 008A1 acceptance harness');
