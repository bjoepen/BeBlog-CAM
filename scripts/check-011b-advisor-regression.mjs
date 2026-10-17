/**
 * 011-B isolated regression gate.
 * Transpile the advisor with the project's TypeScript compiler and execute it
 * against controlled dependency fixtures. No native STEP backend or UI needed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/advisorStepFeasibility.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let holes = [];
let rejected = [];
let sourceOk = true;
const dependencies = {
  './stepManufacturingFeatures': {
    buildOrientedStepManufacturingFeatureSource: () => sourceOk
      ? { ok: true, source: {} }
      : { ok: false, errors: ['Ungültiges BRep'] },
  },
  './stepHoleRecognition': { recognizeStepHoles: () => ({ holes, rejectedCylinderFaceIds: rejected }) },
  './validationGrammar': {
    validateToolCompatibility: (operation) => ({
      level: operation.method === 'helical-mill'
        ? (operation.tool.kind === 'end-mill' ? 'pass' : 'fail')
        : operation.tool.kind === 'drill' ? 'pass' : operation.tool.kind === 'end-mill' ? 'warn' : 'fail',
    }),
  },
};
const exports = {};
vm.runInNewContext(js, { exports, require: (name) => {
  assert.ok(Object.hasOwn(dependencies, name), `Unexpected runtime dependency: ${name}`);
  return dependencies[name];
}});
const screen = exports.screenStepFeasibility;
const hole = Object.freeze({ featureId: 'hole-4', faceIds: Object.freeze([1]), axisDirection: Object.freeze([0, 0, 1]), diameterMm: 4, depthMm: 8 });
const tool = (kind, diameterMm, overrides = {}) => Object.freeze({
  id: `${kind}-${diameterMm}`, name: kind, kind, diameterMm,
  cuttingLengthMm: 12, stickoutMm: 20, ...overrides,
});
const base = Object.freeze({
  summary: Object.freeze({ kind: 'step', fileName: 'fixture.step' }),
  orientation: Object.freeze({ rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0 }),
  stockMode: 'manual', wcs: Object.freeze({ x: 'left', y: 'front', z: 'top' }),
  material: 'aluminium',
});
const run = (tools, overrides = {}) => screen({ ...base, tools, ...overrides });
const check = (name, fn) => { fn(); process.stdout.write(`PASS 011-B: ${name}\n`); };
holes = [hole];
check('Ø4 drill is conditional, never unverified DIRECT', () => {
  const r = run([tool('drill', 4)]);
  assert.equal(r.features[0].coverage, 'CONDITIONAL');
  assert.equal(r.features[0].strategies[0].method, 'drill');
});
check('Ø3 endmill helix is conditional alternative candidate', () => {
  const r = run([tool('end-mill', 3)]);
  assert.equal(r.features[0].coverage, 'CONDITIONAL');
  assert.ok(r.features[0].strategies.some(s => s.method === 'helical-mill' && s.status === 'conditional'));
});
check('wrong drill diameter is rejected', () => {
  assert.equal(run([tool('drill', 5)]).features[0].coverage, 'NOT_COVERED');
});
check('equal-diameter endmill cannot helix', () => {
  assert.ok(!run([tool('end-mill', 4)]).features[0].strategies.some(s => s.method === 'helical-mill'));
});
check('insufficient cutting length is flagged', () => {
  assert.ok(run([tool('drill', 4, { cuttingLengthMm: 3 })]).features[0].strategies[0].reasons.some(s => s.includes('Schneidenlänge')));
});
check('insufficient stickout is flagged', () => {
  assert.ok(run([tool('drill', 4, { stickoutMm: 5 })]).features[0].strategies[0].reasons.some(s => s.includes('Auskragung')));
});
check('missing cutting length fails conservatively', () => {
  assert.ok(run([tool('face-mill', 4, { cuttingLengthMm: undefined })]).features[0].coverage === 'NOT_COVERED');
});
check('no stock is unavailable', () => {
  assert.equal(run([], { stockMode: 'none' }).status, 'unavailable');
});
check('wrong WCS is unavailable', () => {
  assert.equal(run([], { wcs: { ...base.wcs, z: 'bottom' } }).status, 'unavailable');
});
check('DXF is unavailable', () => {
  assert.equal(run([], { summary: { ...base.summary, kind: 'dxf' } }).status, 'unavailable');
});
check('invalid BRep is unavailable', () => {
  sourceOk = false;
  try { assert.equal(run([]).status, 'unavailable'); } finally { sourceOk = true; }
});
check('non-Z hole is not covered', () => {
  holes = [{ ...hole, axisDirection: [1, 0, 0] }];
  try { assert.equal(run([tool('drill', 4)]).features[0].coverage, 'NOT_COVERED'); } finally { holes = [hole]; }
});
check('unclassified cylinder remains UNKNOWN', () => {
  rejected = [7];
  try { assert.equal(run([]).features.find(f => f.faceIds.includes(7)).coverage, 'UNKNOWN'); } finally { rejected = []; }
});
check('invalid hole measurements fail closed', () => {
  for (const changes of [{ diameterMm: NaN }, { diameterMm: Infinity }, { diameterMm: 0 },
    { depthMm: NaN }, { depthMm: -1 }, { axisDirection: [0, 0, NaN] },
    { axisDirection: [0, 0] }, { axisDirection: undefined }]) {
    holes = [{ ...hole, ...changes }];
    try {
      const feature = run([tool('drill', 4)]).features[0];
      assert.equal(feature.coverage, 'NOT_COVERED');
      assert.equal(feature.strategies.length, 0);
    } finally { holes = [hole]; }
  }
});
check('nonfinite tool diameter cannot become a strategy', () => {
  const r = run([tool('drill', Infinity), tool('end-mill', NaN)]);
  assert.equal(r.features[0].coverage, 'NOT_COVERED');
  assert.equal(r.features[0].strategies.length, 0);
});
check('advisor context invalidates on every relevant dependency', () => {
  const context = {
    geometryIdentity: 'step-sha256-fixture', capabilityRevision: '011-D-v1',
    ...base, stockSnapshot: { widthMm: 50, heightMm: 20 },
    tools: [tool('drill', 4)],
  };
  const snapshot = exports.captureAdvisorContext(context);
  assert.ok(snapshot);
  assert.equal(exports.isAdvisorContextCurrent(snapshot, context), true);
  const changed = [
    { geometryIdentity: 'different-geometry' },
    { capabilityRevision: '011-D-v2' },
    { summary: { ...context.summary, fileName: 'renamed.step' } },
    { orientation: { ...context.orientation, rotationZDeg: 90 } },
    { stockMode: 'auto' },
    { stockSnapshot: { ...context.stockSnapshot, widthMm: 51 } },
    { wcs: { ...context.wcs, z: 'bottom' } },
    { material: 'wood' },
    { tools: [tool('drill', 5)] },
  ];
  for (const change of changed) {
    assert.equal(exports.isAdvisorContextCurrent(snapshot, { ...context, ...change }), false);
  }
  assert.equal(exports.isAdvisorContextCurrent(snapshot, { ...context, tools: [tool('drill', 4)] }), true);
});
check('advisor context rejects incomplete or unsafe snapshots', () => {
  const context = { geometryIdentity: 'id', capabilityRevision: 'rev', ...base,
    stockSnapshot: { widthMm: 20 }, tools: [tool('drill', 4)] };
  assert.equal(exports.captureAdvisorContext({ ...context, geometryIdentity: '' }), null);
  assert.equal(exports.captureAdvisorContext({ ...context, capabilityRevision: '' }), null);
  assert.equal(exports.captureAdvisorContext({ ...context, stockSnapshot: { widthMm: NaN } }), null);
  assert.equal(exports.captureAdvisorContext({ ...context, stockSnapshot: undefined }), null);
  assert.equal(exports.isAdvisorContextCurrent(null, context), false);
});
check('advisor context rejects Map, Set and non-plain stock objects', () => {
  const context = { geometryIdentity: 'id', capabilityRevision: 'rev', ...base,
    stockSnapshot: { widthMm: 20 }, tools: [tool('drill', 4)] };
  const accepted = exports.captureAdvisorContext(context);
  assert.ok(accepted);
  for (const stockSnapshot of [
    new Map([['widthMm', 20]]),
    new Set([20]),
    new Date('2026-10-17T00:00:00Z'),
    Object.assign(Object.create({ inheritedWidthMm: 20 }), { heightMm: 5 }),
  ]) {
    assert.equal(exports.captureAdvisorContext({ ...context, stockSnapshot }), null);
    assert.equal(exports.isAdvisorContextCurrent(accepted, { ...context, stockSnapshot }), false);
  }
  const alteredMap = new Map([['widthMm', 21]]);
  assert.equal(exports.captureAdvisorContext({ ...context, stockSnapshot: alteredMap }), null);
  assert.equal(exports.captureAdvisorContext({ ...context,
    stockSnapshot: { widthMm: 20, hidden: undefined } }), null);
  const withSymbol = { widthMm: 20, [Symbol('width')]: 21 };
  assert.equal(exports.captureAdvisorContext({ ...context, stockSnapshot: withSymbol }), null);
});
check('screen is deterministic and does not mutate inputs', () => {
  const tools = Object.freeze([tool('drill', 4)]);
  const first = run(tools);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(run(tools))));
  assert.equal(tools[0].diameterMm, 4);
  assert.equal(base.wcs.z, 'top');
});
console.log('PASS 011-B: 19 isolated advisor regression cases');
