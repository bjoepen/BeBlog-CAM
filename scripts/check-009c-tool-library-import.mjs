import fs from 'node:fs';

const portable=fs.readFileSync(new URL('../src/lib/toolLibraryPortable.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');

const required=[
  [portable.includes('parsePortableToolLibrary'),'portable parser'],
  [portable.includes('JSON.parse(text)'),'JSON parsing'],
  [portable.includes('envelope.schema !== TOOL_LIBRARY_SCHEMA'),'schema validation'],
  [portable.includes('envelope.version !== TOOL_LIBRARY_VERSION'),'version validation'],
  [portable.includes('migrateMillingTool(raw)'),'migration boundary'],
  [portable.includes('isMillingTool(migrated)'),'canonical validation'],
  [portable.includes('ids.has(migrated.id)'),'duplicate IDs inside file rejected'],
  [ui.includes('accept=".json,application/json"'),'JSON file picker'],
  [ui.includes('parsePortableToolLibrary(text)'),'UI uses validated parser'],
  [ui.includes('existingIds.has(item.id)'),'existing ID collision detected'],
  [ui.includes('persist([...library,...parsed.tools])'),'atomic append after validation'],
  [ui.includes('Die Bibliothek wurde nicht verändert.'),'non-destructive duplicate policy'],
  [ui.includes('JSON importieren'),'import action']
];

const failed=required.filter(([ok])=>!ok);
if(failed.length){
  for(const [,label] of failed) console.error(`FAIL 009-C: ${label}`);
  process.exit(1);
}
console.log('PASS 009-C portable tool-library JSON import contract');
