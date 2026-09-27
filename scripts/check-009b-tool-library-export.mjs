import fs from 'node:fs';

const portable=fs.readFileSync(new URL('../src/lib/toolLibraryPortable.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');

const required=[
  [portable.includes("TOOL_LIBRARY_SCHEMA = 'beblog-cam-tool-library'"),'schema marker'],
  [portable.includes('TOOL_LIBRARY_VERSION = 1'),'version 1'],
  [portable.includes('tools: tools.map'),'tool order/data export'],
  [portable.includes('JSON.stringify(createPortableToolLibrary(tools), null, 2)'),'deterministic pretty JSON'],
  [ui.includes('serializePortableToolLibrary(library)'),'UI exports current library'],
  [ui.includes('disabled={library.length===0}'),'empty export disabled'],
  [ui.includes('JSON exportieren'),'export action']
];

const failed=required.filter(([ok])=>!ok);
if(failed.length){
  for(const [,label] of failed) console.error(`FAIL 009-B: ${label}`);
  process.exit(1);
}
console.log('PASS 009-B portable tool-library JSON export contract');
