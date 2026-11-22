import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compile } from 'svelte/compiler';

const check = (name, fn) => { fn(); console.log(`PASS 011-G4-C2: ${name}`); };

const runTs = (file, dependencyMap = {}) => {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const require = name => {
    if (name in dependencyMap) return dependencyMap[name];
    throw new Error(`Unexpected runtime dependency ${name} from ${file}`);
  };
  vm.runInNewContext(output, { exports, require, JSON, Number, Math, String, Object, Array, Set, Map });
  return exports;
};
const defaultExports = runTs('src/lib/types.ts');
const selectionExports = runTs('src/lib/dxfMultiTargetSelection.ts');
const trochoidExports = runTs('src/lib/trochoidalContourContract.ts');
const storeStub = { writable: initial => ({ set(value) { this.value = value; }, value: initial }) };
const operationsExports = runTs('src/lib/operationsProject.ts', {
  './types': defaultExports,
  './dxfMultiTargetSelection': selectionExports,
  './trochoidalContourContract': trochoidExports,
  'svelte/store': storeStub
});

check('switching operations preserves each operation’s independently stored geometry and form state', () => {
  const first = { ...defaultExports.defaultContourOperation, id: 'contour-a', contourId: 8, contourIds: [8], stepDownMm: 2.25 };
  const second = { ...defaultExports.defaultPocketOperation, id: 'pocket-b', stepFaceId: 12, feedMmMin: 321 };
  const input = { operations: [first, second], activeOperationId: first.id };
  const before = JSON.stringify(input);
  const switched = operationsExports.selectOperation(input, second.id);
  assert.equal(switched.activeOperationId, second.id);
  assert.equal(JSON.stringify(switched.operations[0]), JSON.stringify(first));
  assert.equal(JSON.stringify(switched.operations[1]), JSON.stringify(second));
  assert.equal(JSON.stringify(input), before);
  const back = operationsExports.selectOperation(switched, first.id);
  assert.equal(back.activeOperationId, first.id);
  assert.equal(back.operations[0].stepDownMm, 2.25);
  assert.equal(back.operations[1].stepFaceId, 12);
});
const app = fs.readFileSync('src/App.svelte', 'utf8');
const compiled = compile(app, { filename: 'src/App.svelte' });
const bearbeitung = app.slice(app.indexOf("{:else if activeStep==='Bearbeiten'}"), app.indexOf("{:else if activeStep==='Prüfen'}"));

check('Svelte component compiles and has exactly three independent native disclosure sections', () => {
  assert.ok(compiled.js.code.length > 0);
  assert.equal((bearbeitung.match(/<details class="edit-accordion"/g) ?? []).length, 3);
  assert.equal((bearbeitung.match(/<\/details>/g) ?? []).length, 3);
  assert.equal((bearbeitung.match(/<summary>/g) ?? []).length, 3);
  assert.ok(bearbeitung.includes('<details class="edit-accordion" open>'));
  assert.ok(bearbeitung.includes('<details class="edit-accordion"><summary>'));
  assert.ok(!bearbeitung.includes('<details class="edit-accordion"><details'));
});

check('operation list, operation selection and add/remove actions remain before accordions', () => {
  const list = bearbeitung.indexOf('class="operation-list"');
  const add = bearbeitung.indexOf('class="operation-add"');
  const kindSelection = bearbeitung.indexOf('Aktive Bearbeitung');
  const target = bearbeitung.indexOf('Ziel &amp; Geometrie');
  assert.ok(list >= 0 && add > list && kindSelection > add && target > kindSelection);
  assert.ok(bearbeitung.includes('activateOperation(op.id)'));
  assert.ok(bearbeitung.includes('appendOperation('));
  assert.ok(bearbeitung.includes('deleteOperation(op.id)'));
  assert.ok(bearbeitung.includes('class="edit-global-error" role="alert"'));
  const headerEnd = bearbeitung.indexOf('<details class="edit-accordion"');
  const persistentHeader = bearbeitung.slice(0, headerEnd);
  assert.ok(persistentHeader.includes('Durchbohren nicht möglich') && persistentHeader.includes('Durchfräsen nicht freigegeben'));
});

check('existing STEP and DXF geometry-selection contracts stay in the target section', () => {
  for (const contract of ['onStepContourChange', 'onStepFaceIdChange', 'onStepHoleFeatureIdsChange', 'onSelectContour={selectContour}', 'onSelectCarveCurve={toggleCarveCurve}', 'onSelectDrillCurve={toggleDrillCurve}']) assert.ok(app.includes(contract));
  for (const contract of ['stepWireId', 'stepFaceId', 'stepHoleFeatureIds', 'contourId', 'curveIds', 'Geometrie auswählen']) assert.ok(bearbeitung.includes(contract));
  const targetSection = bearbeitung.slice(bearbeitung.indexOf('Ziel &amp; Geometrie'), bearbeitung.indexOf('Werkzeug &amp; Schnittdaten'));
  const strategySection = bearbeitung.slice(bearbeitung.indexOf('Strategie &amp; Details'));
  assert.ok(targetSection.includes('stepHoleFeatureIds') && targetSection.includes('stepFaceId'));
  assert.ok(strategySection.includes('Herstellungsverfahren') && strategySection.includes('Bohrtiefe'));
});

check('DOM-dependent guards retain their labels and selector-bearing subsection', () => {
  assert.ok(bearbeitung.includes('<div class="placement-section"><p class="placement-title">Bohrtiefe</p>'));
  assert.ok(bearbeitung.includes('>Manuell</button>'));
  assert.ok(bearbeitung.includes('>Durch Rohling</button>'));
  const guard = fs.readFileSync('src/lib/dxfNoStockDrillGuard.ts', 'utf8');
  assert.ok(guard.includes('placement-section') && guard.includes('Bohrtiefe'));
  assert.ok(guard.includes('Durch Rohling'));
  const control = fs.readFileSync('src/lib/toolpath25dControl.ts', 'utf8');
  assert.ok(control.includes(".inspector label") || control.includes("querySelectorAll('label')"));
});

check('collapsing is native visibility only; input bindings and App-owned operation switching stay intact', () => {
  assert.ok(!bearbeitung.includes('onToggle=') && !bearbeitung.includes('ontoggle='));
  assert.ok(!bearbeitung.includes('bind:open=') && !bearbeitung.includes('on:toggle='));
  assert.ok(bearbeitung.includes('value={operation.tool.diameterMm}'));
  assert.ok(bearbeitung.includes('value={operation.feedMmMin}'));
  assert.ok(app.includes('operationsProject=selectOperation(operationsProject,id)'));
  assert.ok(app.includes('operation=cloneOperation(next)'));
});

check('resizing shell and full-page tool view are untouched', () => {
  const shell = fs.readFileSync('src/lib/InspectorShell.svelte', 'utf8');
  assert.ok(shell.includes('--inspector-width'));
  assert.ok(shell.includes('inspector'));
  assert.ok(app.includes('class="tool-shell"'));
});

// The summary module is tested against the real operation defaults and production
// helpers, while the component remains the owner of all mutable CAM state.
const summarize = (operation, importKind) => {
  const output = ts.transpileModule(fs.readFileSync('src/lib/editingAccordionSummary.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const zLevelOperationState = { zLevelMode: op => op.roughingMode ?? 'face-target' };
  const operationsProject = { dxfTargetIds: op => [...new Set(op.contourIds?.length ? op.contourIds : op.contourId == null ? [] : [op.contourId])].sort((a, b) => a - b) };
  vm.runInNewContext(output, { exports, require: name => name.includes('zLevelOperationState') ? zLevelOperationState : operationsProject, JSON, Number, Math, String });
  return exports.buildEditingAccordionSummaries(operation, importKind);
};
const defaults = defaultExports;

check('closed summaries accurately reflect geometry, cut data and strategy across all operation kinds', () => {
  const cases = [
    [defaults.defaultFacingOperation, null, 'Keine Geometrieauswahl erforderlich'],
    [defaults.defaultCarveOperation, 'dxf', '0 offene DXF-Geometrien ausgewählt'],
    [defaults.defaultDrillOperation, 'step', 'keine STEP-Bohrung gewählt'],
    [defaults.defaultContourOperation, 'step', 'keine STEP-Kontur gewählt'],
    [defaults.defaultPocketOperation, 'step', 'keine STEP-Fläche gewählt'],
    [{ ...defaults.defaultContourOperation, kind: 'trochoidal-contour-roughing', contourId: null, trochoidRadiusMm: 1, side: 'outside', direction: 'climb' }, 'dxf', 'keine DXF-Kontur gewählt'],
    [defaults.defaultZLevelRoughingOperation, 'step', 'keine STEP-Fläche gewählt'],
    [defaults.defaultThreeDRoughingOperation, 'step', 'keine STEP-Fläche gewählt'],
    [defaults.defaultSurfaceFinishingOperation, 'step', 'keine STEP-Fläche gewählt']
  ];
  for (const [operation, kind, expected] of cases) {
    if (!operation?.kind) continue;
    const result = summarize(operation, kind);
    assert.ok(result.target.includes(expected), `${operation.kind}: ${result.target}`);
    assert.ok(result.toolAndCut.includes('mm') && result.toolAndCut.includes('1/min'));
    assert.ok(result.strategy.length > 0);
  }
});

check('contour summaries use topology-specific side values for every open and closed option', () => {
  const openCases = [['left', 'links'], ['right', 'rechts'], ['on-line', 'auf Linie']];
  for (const [openSide, label] of openCases) {
    const operation = { ...defaults.defaultContourOperation, topology: 'open', openSide, side: 'inside' };
    assert.ok(summarize(operation, 'step').strategy.includes(`Offene Kontur · ${label} ·`));
  }
  const closedCases = [['outside', 'außen'], ['inside', 'innen'], ['on-line', 'auf Linie']];
  for (const [side, label] of closedCases) {
    const operation = { ...defaults.defaultContourOperation, topology: 'closed', side, openSide: 'left' };
    assert.ok(summarize(operation, 'step').strategy.includes(`Geschlossene Kontur · ${label} ·`));
  }
});

check('trochoidal summary reports effective stock-bottom or manual depth without stale manual depth', () => {
  const manual = { ...trochoidExports.defaultTrochoidalContourContract, totalDepthMm: 3, depthMode: 'manual' };
  const manualResult = summarize(manual, 'dxf');
  assert.ok(manualResult.toolAndCut.includes('Tiefe 3 mm'));
  assert.ok(manualResult.strategy.includes('Manuelle Gesamttiefe'));
  const through = { ...manual, depthMode: 'stock-bottom', totalDepthMm: 3 };
  const throughResult = summarize(through, 'dxf');
  assert.ok(throughResult.toolAndCut.includes('Tiefe bis Rohlingunterseite'));
  assert.ok(!throughResult.toolAndCut.includes('Tiefe 3 mm'));
  assert.ok(throughResult.strategy.includes('Tiefe bis Rohlingunterseite'));
});

check('all four target controls are inside Ziel & Geometrie, with strategy controls kept separate', () => {
  const targetStart = bearbeitung.indexOf('<details class="edit-accordion" open>');
  const targetEnd = bearbeitung.indexOf('</details>', targetStart) + '</details>'.length;
  const strategyStart = bearbeitung.indexOf('<details class="edit-accordion"><summary><span><strong>Strategie &amp; Details');
  const target = bearbeitung.slice(targetStart, targetEnd);
  const strategy = bearbeitung.slice(strategyStart);
  for (const text of ['Wirbelfräsen Kontur', 'Schruppziel', 'setZLevelRoughingMode', 'Inneninseln', 'updateZLevelRoughing({islandMode', '3D-Schruppziel', 'STEP/BRep-Zielflächen']) assert.ok(target.includes(text), `target section misses ${text}`);
  for (const text of ['Bahnseite &amp; Richtung', 'updateTrochoidal({side:', 'updateTrochoidal({direction:', 'Schruppstrategie', 'Schlichtstrategie']) assert.ok(strategy.includes(text), `strategy section misses ${text}`);
  assert.equal((app.match(/onclick=\{\(\)=>setZLevelRoughingMode\(/g) ?? []).length, 2);
  assert.equal((app.match(/onclick=\{\(\)=>updateZLevelRoughing\(\{islandMode:/g) ?? []).length, 2);
  assert.ok(app.includes(`onSelectedFaceIdsChange={operation.kind==='surface-finishing'?updateSurfaceFinishingFaceIds`));
  assert.ok(app.includes(`selectedFaceIds={activeStep==='Bearbeiten'`));
});

check('multi-target summaries use the production DXF identity set and respect open-contour selection', () => {
  const pocket = { ...defaults.defaultPocketOperation, contourIds: [7, 3, 7] };
  assert.match(summarize(pocket, 'dxf').target, /^2 DXF-Konturen ausgewählt$/);
  const openContour = { ...defaults.defaultContourOperation, topology: 'open', contourId: 4, contourIds: [1, 2] };
  assert.equal(summarize(openContour, 'dxf').target, '1 DXF-Kontur ausgewählt');
});
