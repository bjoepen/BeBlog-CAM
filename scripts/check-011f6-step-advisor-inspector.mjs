import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compile } from 'svelte/compiler';

const panel = fs.readFileSync(new URL('../src/lib/StepAdvisorPanel.svelte', import.meta.url), 'utf8');
const compiledPanel = compile(panel, { filename: 'StepAdvisorPanel.svelte', generate: 'client' });
assert.ok(compiledPanel.js.code.length > 0, 'Svelte inspector must compile');
assert.match(panel, /<table>/);
assert.match(panel, /<th scope="col">Werkzeug<\/th>/);
assert.match(panel, /aria-expanded=\{expandedFeatureIds\.includes\(feature\.featureId\)\}/);
assert.match(panel, /Bohren.*Helixfräsen/s);
assert.match(panel, /Nicht verfügbar/);
assert.match(panel, /check\.reason/);
assert.match(panel, /Allgemeine Advisor-Hinweise/);
assert.match(panel, /Featurespezifische Warnungen/);
assert.doesNotMatch(panel, /Operation (übernehmen|erzeugen)|NC (erzeugen|exportieren)/i);
const expandedBlock = panel.indexOf('{#if expandedFeatureIds.includes(feature.featureId)}');
const detailBuild = panel.indexOf('buildStepAdvisorFeatureDetails(feature.featureId, matches, cuttingAdvice)');
assert.ok(detailBuild > expandedBlock, 'detail-only searches must stay inside the expanded feature block');
assert.equal(panel.match(/buildStepAdvisorFeatureDetails\(/g)?.length, 1,
  'feature detail rows must be calculated only once in the component');

const loadTs = path => {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }}).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: () => ({}) });
  return exports;
};

const { toggleExpandedFeature } = loadTs('../src/lib/stepAdvisorDisclosure.ts');
let open = toggleExpandedFeature([], 'hole-1');
open = toggleExpandedFeature(open, 'hole-2');
assert.deepEqual(Array.from(open), ['hole-1', 'hole-2']);
open = toggleExpandedFeature(open, 'hole-1');
assert.deepEqual(Array.from(open), ['hole-2']);

const { buildStepAdvisorCandidateRows } = loadTs('../src/lib/stepAdvisorInspector.ts');
const { buildStepAdvisorFeatureDetails } = loadTs('../src/lib/stepAdvisorInspector.ts');
const match = { featureId: 'hole-1', status: 'conditional', candidates: [
  { toolId: 'drill-8', toolName: 'Bohrer 8', method: 'drill', reasons: ['Bohrprüfung offen'] },
  { toolId: 'mill-6', toolName: 'Fräser 6', method: 'helical-mill', reasons: ['Helixprüfung offen'] },
  { toolId: 'missing', toolName: 'Ohne Werte', method: 'drill', reasons: [] }
] };
const advice = [
  { featureId: 'hole-1', toolId: 'mill-6', toolName: 'Fräser 6', method: 'helical-mill', status: 'conditional', spindleRpm: 8200, feedMmMin: 360, notes: ['Helixhinweis'] },
  { featureId: 'hole-1', toolId: 'drill-8', toolName: 'Bohrer 8', method: 'drill', status: 'conditional', spindleRpm: 3000, feedMmMin: 120, notes: ['Bohrhinweis'] }
];
const rows = buildStepAdvisorCandidateRows(match, advice);
assert.equal(rows.length, 3, 'all candidates must remain visible');
assert.deepEqual([rows[0].method, rows[0].spindleRpm, rows[0].feedMmMin], ['drill', 3000, 120]);
assert.deepEqual([rows[1].method, rows[1].spindleRpm, rows[1].feedMmMin], ['helical-mill', 8200, 360]);
assert.equal(rows[2].spindleRpm, null, 'missing values must remain unavailable');
assert.equal(rows[2].feedMmMin, null);
const wrongName = buildStepAdvisorCandidateRows(match, [{ ...advice[0], toolName: 'Stale name' }, advice[1]]);
assert.equal(wrongName[1].spindleRpm, null, 'name mismatch must fail closed');
const ambiguous = buildStepAdvisorCandidateRows(match, [...advice, { ...advice[1], spindleRpm: 9999 }]);
assert.equal(ambiguous[0].spindleRpm, null, 'ambiguous values must not be selected by position');
const wrongFeature = buildStepAdvisorCandidateRows(match, [{ ...advice[1], featureId: 'hole-2' }]);
assert.equal(wrongFeature[0].spindleRpm, null, 'another feature values must not leak');

// Multiple features, candidates and contradictory values must remain isolated and fail closed.
const secondMatch = { featureId: 'hole-2', status: 'conditional', candidates: [
  { toolId: 'drill-8', toolName: 'Bohrer 8', method: 'drill', reasons: ['Zweite Bohrung'] },
  { toolId: 'mill-4', toolName: 'Fräser 4', method: 'helical-mill', reasons: [] }
] };
const multiAdvice = [
  ...advice,
  { featureId: 'hole-2', toolId: 'drill-8', toolName: 'Bohrer 8', method: 'drill', status: 'conditional', spindleRpm: 4100, feedMmMin: 140, notes: ['Feature 2'] },
  { featureId: 'hole-2', toolId: 'mill-4', toolName: 'Fräser 4', method: 'helical-mill', status: 'conditional', spindleRpm: 9000, feedMmMin: 300, notes: ['Widerspruch A'] },
  { featureId: 'hole-2', toolId: 'mill-4', toolName: 'Fräser 4', method: 'helical-mill', status: 'conditional', spindleRpm: 9500, feedMmMin: 320, notes: ['Widerspruch B'] }
];
const firstDetails = buildStepAdvisorFeatureDetails('hole-1', [match, secondMatch], multiAdvice);
assert.equal(firstDetails.matchRows.length, 1);
assert.equal(firstDetails.matchRows[0].rows[0].spindleRpm, 3000,
  'feature 1 must retain its own cutting values');
assert.equal(firstDetails.unresolvedAdvice.length, 0);
const secondDetails = buildStepAdvisorFeatureDetails('hole-2', [match, secondMatch], multiAdvice);
assert.equal(secondDetails.matchRows.length, 1);
assert.equal(secondDetails.matchRows[0].rows[0].spindleRpm, 4100,
  'same tool identity on another feature must use feature 2 values');
assert.equal(secondDetails.matchRows[0].rows[1].spindleRpm, null,
  'contradictory values must remain unavailable');
assert.equal(secondDetails.matchRows[0].rows[1].feedMmMin, null);
assert.equal(secondDetails.unresolvedAdvice.length, 2,
  'all contradictory advice warnings must remain accessible');
assert.deepEqual(Array.from(secondDetails.unresolvedAdvice, item => item.notes[0]),
  ['Widerspruch A', 'Widerspruch B']);
console.log('011-F6 STEP advisor inspector PASS');
