import fs from 'node:fs';

const app = fs.readFileSync('src/App.svelte', 'utf8');
const start = app.indexOf('async function loadCamProject()');
const end = start >= 0 ? app.indexOf('\n</script>', start) : -1;
const load = start >= 0 && end > start ? app.slice(start, end) : '';

function acceptance(name, condition, detail = '') {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

const importWired = app.includes("import { resolveProjectSource } from './lib/projectSourceRecovery';");
const resolverCall = load.includes('await resolveProjectSource({source:project.source');
const inspectorUsesCandidate = load.includes("inspect:sourcePath=>invoke<ImportSummary>('inspect_import',{path:sourcePath})");
const relocationDialog = load.includes("extensions:['step','stp','dxf']") && load.includes('relocate:async source=>');
const resolvedSummaryAssignment = load.indexOf('importSummary=resolvedSource.summary;');
const resolvedPathAssignment = load.indexOf('sourcePath=resolvedSource.path;');
const firstProjectStateAssignment = load.indexOf('stock={...project.setup.stock};');
const resolverPosition = load.indexOf('const resolvedSource=await resolveProjectSource(');
const oldDirectRestore = load.includes("const restoredSummary=await invoke<ImportSummary>('inspect_import',{path:project.source.path})");

acceptance('008B3b source recovery is wired into project load', importWired && resolverCall && inspectorUsesCandidate);
acceptance('008B3b relocation dialog is CAD-scoped', relocationDialog);
acceptance('008B3b project state is applied only after source resolution', resolverPosition >= 0 && resolvedSummaryAssignment > resolverPosition && resolvedPathAssignment > resolverPosition && firstProjectStateAssignment > resolvedPathAssignment);
acceptance('008B3b relocated source becomes active project source', resolvedSummaryAssignment >= 0 && resolvedPathAssignment > resolvedSummaryAssignment);
acceptance('008B3b legacy direct source restore is removed', !oldDirectRestore);

if (!process.exitCode) {
  console.log('PASS 008B3b project load integration: source recovery resolves and validates the CAD source before any saved setup or operation state is applied.');
}
