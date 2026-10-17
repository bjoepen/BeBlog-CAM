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
check('screen is deterministic and does not mutate inputs', () => {
  const tools = Object.freeze([tool('drill', 4)]);
  const first = run(tools);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(run(tools))));
  assert.equal(tools[0].diameterMm, 4);
  assert.equal(base.wcs.z, 'top');
});
console.log('PASS 011-B: 16 isolated advisor regression cases');
