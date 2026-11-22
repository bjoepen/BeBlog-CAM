import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compile } from 'svelte/compiler';

const loadTs = file => {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  }}).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, JSON, Number, Math });
  return exports;
};

const layout = loadTs('src/lib/inspectorLayout.ts');
const check = (name, fn) => { fn(); console.log(`PASS 011-G4-B: ${name}`); };
const equalJson = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

check('default width is 330 px and prior mode-tagged preferences are retained', () => {
  equalJson(layout.normalizeInspectorLayoutPreference(null), { width: 330 });
  equalJson(layout.normalizeInspectorLayoutPreference({ mode: 'compact', width: 330 }), { width: 330 });
  equalJson(layout.normalizeInspectorLayoutPreference({ mode: 'expanded', width: 520 }), { width: 520 });
  equalJson(layout.normalizeInspectorLayoutPreference({ mode: 'custom', width: 486 }), { width: 486 });
});

check('requested widths are validated, rounded and clamped to 330–650 px', () => {
  equalJson(layout.normalizeInspectorLayoutPreference({ width: 451.7 }), { width: 452 });
  assert.equal(layout.normalizeInspectorLayoutPreference({ width: 100 }).width, 330);
  assert.equal(layout.normalizeInspectorLayoutPreference({ width: 900 }).width, 650);
  assert.equal(layout.normalizeInspectorLayoutPreference({ width: Infinity }).width, 330);
  assert.equal(layout.normalizeInspectorLayoutPreference({ mode: 'unknown', width: 500 }).width, 330);
});

check('available workspace width preserves the 450 px viewport across window sizes', () => {
  const cases = [{ workspace: 830, width: 520, expected: 380 }, { workspace: 950, width: 650, expected: 500 }, { workspace: 1300, width: 650, expected: 650 }];
  for (const value of cases) {
    const actual = layout.clampInspectorWidth(value.width, value.workspace);
    assert.equal(actual, value.expected);
    assert.ok(value.workspace - actual >= 450);
  }
});

check('consecutive pointer moves update width immediately and clamp at layout limits', () => {
  const firstMove = layout.inspectorWidthFromDrag(500, 600, 590, 1100);
  const secondMove = layout.inspectorWidthFromDrag(500, 600, 580, 1100);
  assert.equal(firstMove, 510);
  assert.equal(secondMove, 520);
  assert.equal(layout.inspectorWidthFromDrag(500, 600, 560, 1100), 540);
  assert.equal(layout.inspectorWidthFromDrag(340, 600, 900, 1100), 330);
  assert.equal(layout.inspectorWidthFromDrag(640, 600, 100, 1100), 650);
  assert.equal(layout.inspectorWidthFromDrag(500, 600, 500, 830), 380);
});

check('component streams pointer moves into App width and handles capture loss and reset', () => {
  const shell = shellCss();
  const app = fs.readFileSync('src/App.svelte', 'utf8');
  assert.ok(shell.includes('width = inspectorWidthFromDrag('));
  assert.ok(shell.includes('onpointermove={moveResize}') && shell.includes('(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)'));
  assert.ok(shell.includes('onpointercancel={finishResize}') && shell.includes('onlostpointercapture={finishResize}'));
  assert.ok(shell.includes('ondblclick={resetWidth}') && shell.includes('width = INSPECTOR_DEFAULT_WIDTH'));
  assert.ok(app.includes('bind:width={inspectorWidth}'));
  assert.ok(app.includes('style={`--inspector-width:${effectiveInspectorWidth}px`}'));
});

check('keyboard resize supports 16 px, accelerated 64 px, and ignores unrelated keys', () => {
  assert.equal(layout.keyboardInspectorResizeDelta('ArrowRight', false), 16);
  assert.equal(layout.keyboardInspectorResizeDelta('ArrowLeft', false), -16);
  assert.equal(layout.keyboardInspectorResizeDelta('ArrowRight', true), 64);
  assert.equal(layout.keyboardInspectorResizeDelta('Enter', false), null);
});

check('layout preference persists separately and invalid or unavailable storage fails closed', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const preference = { width: 486 };
  assert.equal(layout.saveInspectorLayoutPreference(storage, preference), true);
  equalJson(layout.loadInspectorLayoutPreference(storage), preference);
  values.set(layout.INSPECTOR_LAYOUT_STORAGE_KEY, '{broken');
  equalJson(layout.loadInspectorLayoutPreference(storage), { width: 330 });
  assert.equal(layout.saveInspectorLayoutPreference({ setItem: () => { throw new Error('storage disabled'); } }, preference), false);
  equalJson(layout.loadInspectorLayoutPreference({ getItem: () => { throw new Error('storage disabled'); } }), { width: 330 });
});

check('shared shell and App compile with six original step branches', () => {
  const shell = fs.readFileSync('src/lib/InspectorShell.svelte', 'utf8');
  const app = fs.readFileSync('src/App.svelte', 'utf8');
  assert.ok(compile(shell, { filename: 'InspectorShell.svelte', generate: 'client' }).js.code.length > 0);
  assert.ok(compile(app, { filename: 'App.svelte', generate: 'client' }).js.code.length > 0);
  for (const step of ['Bauteil', 'Rohling', 'Werkzeuge', 'Bearbeiten', 'Prüfen', 'Fräsen']) assert.ok(app.includes(`activeStep==='${step}'`));
  assert.equal((app.match(/<InspectorShell\b/g) ?? []).length, 1, 'all step branches share one inspector shell');
  assert.ok(shell.includes('role="separator"') && shell.includes('tabindex="0"'));
  assert.ok(shell.includes('onpointerdown={startResize}') && shell.includes('onkeydown={keyResize}'));
});

check('workspace enforces viewport minimum and preserves the Werkzeug-Vollseitenansicht', () => {
  const css = fs.readFileSync('src/inspector-layout.css', 'utf8');
  const appCss = fs.readFileSync('src/app.css', 'utf8');
  const calculatorCss = fs.readFileSync('src/lib/FeedsSpeedsCalculatorCore.svelte', 'utf8');
  assert.match(css, /minmax\(450px,\s*1fr\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(450px,\s*1fr\)\s+var\(--inspector-width,\s*330px\)/);
  assert.match(appCss, /min-width:980px/);
  assert.ok(calculatorCss.includes('.workspace:has(.tools-page)') && calculatorCss.includes('grid-template-columns:minmax(0,1fr)!important'));
  assert.ok(calculatorCss.includes('.workspace:has(.tools-page)>.viewport') && calculatorCss.includes('display:none!important'));
  assert.ok(css.includes('.workspace:has(.tools-page) > .inspector-divider'));
});

check('divider stays outside the scrollable inspector and only overlays the two-column boundary', () => {
  const shell = shellCss();
  const divider = shell.match(/<div\s+class="inspector-divider"([\s\S]*?)<\/div>/)?.[0] ?? '';
  const styles = shell.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const dividerStyles = styles.match(/\.inspector-divider\s*\{([^}]+)\}/)?.[1] ?? '';
  const bearbeitenCss = fs.readFileSync('src/bearbeiten-inspector.css', 'utf8');
  assert.ok(shell.indexOf('<div\n  class="inspector-divider"') < shell.indexOf('<aside class="inspector"'), 'divider is a sibling before the inspector');
  assert.ok(divider.includes('role="separator"'));
  assert.match(dividerStyles, /position:\s*absolute/);
  assert.match(dividerStyles, /left:\s*calc\(100% - var\(--inspector-width/);
  assert.match(dividerStyles, /top:\s*50%/);
  assert.match(fs.readFileSync('src/inspector-layout.css', 'utf8'), /\.workspace\s*\{\s*position:\s*relative/);
  assert.doesNotMatch(shell, /inspector-layout-controls|Kompakt|Erweitert|inspector-width\{/);
  assert.match(bearbeitenCss, /\.inspector\{[^}]*overflow-x:hidden/);
});

check('divider exposes current value and independent keyboard operation to assistive technology', () => {
  const shell = shellCss();
  assert.ok(shell.includes('aria-label="Breite des Inspectors ändern"'));
  assert.ok(shell.includes('aria-valuemin={INSPECTOR_MIN_WIDTH}'));
  assert.ok(shell.includes('aria-valuemax={availableMaxWidth}'));
  assert.ok(shell.includes('aria-valuenow={effectiveWidth}'));
  assert.ok(shell.includes('aria-valuetext={`${effectiveWidth} Pixel`}'));
  assert.ok(shell.includes('onkeydown={keyResize}') && shell.includes('tabindex="0"'));
  assert.ok(shell.includes('Home') && shell.includes('End'));
});

function shellCss() {
  return fs.readFileSync('src/lib/InspectorShell.svelte', 'utf8');
}

check('existing DOM-based editing helpers keep their inspector selectors', () => {
  const toolpath = fs.readFileSync('src/lib/toolpath25dControl.ts', 'utf8');
  const guard = fs.readFileSync('src/lib/dxfNoStockDrillGuard.ts', 'utf8');
  assert.ok(toolpath.includes("querySelectorAll<HTMLLabelElement>('.inspector label')"));
  assert.ok(toolpath.includes("querySelector<HTMLElement>('.inspector h2')"));
  assert.ok(guard.includes("querySelector<HTMLElement>('.inspector')"));
  assert.ok(guard.includes("querySelectorAll<HTMLElement>('.placement-section')"));
  assert.ok(fs.readFileSync('src/main.ts', 'utf8').includes("import './inspector-layout.css'"));
});

check('layout resizing does not own or reset the active step, operations or project state', () => {
  const app = fs.readFileSync('src/App.svelte', 'utf8');
  const shell = fs.readFileSync('src/lib/InspectorShell.svelte', 'utf8');
  for (const stateName of ['activeStep', 'operationsProject', 'operation', 'stock', 'wcs', 'fixtures']) {
    assert.ok(app.includes(`let ${stateName}`), `App remains the owner of ${stateName}`);
    assert.ok(!shell.includes(stateName), `layout shell does not access ${stateName}`);
  }
  assert.ok(app.includes('function goToStep(step:string)'));
  assert.ok(app.includes('function setOperation(next:CamOperation)'));
  assert.ok(shell.includes('<slot />'), 'existing content remains mounted inside the common shell');
});

check('layout preference is not included in CAM project serialization or fach state', () => {
  const persistence = fs.readFileSync('src/lib/projectPersistence.ts', 'utf8');
  assert.ok(!persistence.includes('inspectorWidth') && !persistence.includes('inspectorMode'));
  const app = fs.readFileSync('src/App.svelte', 'utf8');
  assert.ok(app.includes('saveInspectorLayoutPreference(localStorage, preference)'));
  assert.ok(app.includes('loadInspectorLayoutPreference(localStorage)'));
  assert.ok(app.includes('new ResizeObserver(updateWorkspaceWidth)'));
});

console.log('011-G4-B adaptive inspector layout PASS');
