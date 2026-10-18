import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/stepOperationProposals.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => { throw Error('Unexpected runtime dependency'); } });
const propose = exports.proposeStepOperations;
const feature = { featureId: 'hole-1', kind: 'hole', diameterMm: 8, depthMm: 12, reasons: [] };
const report = { status: 'screened', features: [feature] };
const matches = [{ featureId: 'hole-1', status: 'conditional', candidates: [{ toolId: 't1', toolName: 'Bohrer', method: 'drill', reasons: ['Preflight offen'] }] }];
const advice = [{ featureId: 'hole-1', toolId: 't1', toolName: 'Bohrer', method: 'drill', status: 'conditional', spindleRpm: 3000, feedMmMin: 120, notes: ['Startwert'] }];
const result = propose(report, matches, advice);
assert.equal(result.length, 1);
assert.equal(result[0].status, 'conditional');
assert.equal(result[0].toolName, 'Bohrer');
assert.equal(result[0].depthMm, 12);
assert.ok(result[0].cautions.some(c => c.includes('Preflight')));
assert.equal(propose(null, matches, advice).length, 0);
assert.equal(propose({ ...report, status: 'unavailable' }, matches, advice).length, 0);
assert.equal(propose(report, matches, [{ ...advice[0], toolName: 'stale' }]).length, 0);
assert.equal(propose(report, matches, [{ ...advice[0], feedMmMin: NaN }]).length, 0);
assert.equal(propose(report, matches, [...advice, ...advice]).length, 0);
assert.equal(propose({ ...report, features: [{ ...feature, kind: 'unclassified-cylinder' }] }, matches, advice).length, 0);
assert.equal(propose({ ...report, features: [{ ...feature, depthMm: 0 }] }, matches, advice).length, 0);
assert.equal(propose({ ...report, features: [feature, feature] }, matches, advice).length, 0);

// Helical milling must retain its own method, tool identity, values and warnings.
const helixMatches = [{ featureId: 'hole-1', status: 'conditional', candidates: [
  { toolId: 'mill-6', toolName: 'Schaftfräser 6 mm', method: 'helical-mill',
    reasons: ['Helix-Eintauchfähigkeit prüfen'] }
] }];
const helixAdvice = [{ featureId: 'hole-1', toolId: 'mill-6', toolName: 'Schaftfräser 6 mm',
  method: 'helical-mill', status: 'conditional', spindleRpm: 8200, feedMmMin: 360,
  notes: ['Helixgeometrie und radiale Zustellung prüfen'] }];
const helixResult = propose(report, helixMatches, helixAdvice);
assert.equal(helixResult.length, 1);
assert.equal(helixResult[0].method, 'helical-mill');
assert.equal(helixResult[0].toolId, 'mill-6');
assert.equal(helixResult[0].toolName, 'Schaftfräser 6 mm');
assert.equal(helixResult[0].spindleRpm, 8200);
assert.equal(helixResult[0].feedMmMin, 360);
assert.ok(helixResult[0].cautions.some(c => c.includes('Helix-Eintauchfähigkeit')));
assert.ok(helixResult[0].cautions.some(c => c.includes('Helixgeometrie')));
assert.equal(propose(report, helixMatches, [{ ...helixAdvice[0], method: 'drill' }]).length, 0);
assert.equal(propose(report, matches, [{ ...advice[0], method: 'helical-mill' }]).length, 0);
assert.equal(propose(report, helixMatches, [{ ...helixAdvice[0], toolId: 'other' }]).length, 0);

const app = fs.readFileSync(new URL('../src/App.svelte', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../src/lib/StepAdvisorPanel.svelte', import.meta.url), 'utf8');
assert.match(app, /proposeStepOperations\(advisorReport, advisorMatches, advisorCuttingAdvice\)/);
assert.match(app, /operationProposals=\{advisorOperationProposals\}/);
assert.match(panel, /Operationsvorschlag \(bedingt\)/);
console.log('011-F3 read-only operation proposals PASS');
