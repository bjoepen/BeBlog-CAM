import fs from 'node:fs';

const types=fs.readFileSync(new URL('../src/lib/toolTypes.ts',import.meta.url),'utf8');
const grammar=fs.readFileSync(new URL('../src/lib/validationGrammar.ts',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');

const required=[
  [types.includes("'drill' | 'fiber-cutter'"),'tool kind union'],
  [types.includes("pointAngleDeg: number"),'drill point angle'],
  [types.includes("'drill': 'Bohrer'"),'drill label'],
  [types.includes("'fiber-cutter': 'Faserfräser'"),'fiber cutter label'],
  [types.includes("if(kind==='drill')return {...geometry,kind:'drill',pointAngleDeg"),'drill migration'],
  [grammar.includes("kind === 'drill') return { level: 'pass'"),'axial drill PASS'],
  [grammar.includes("kind === 'end-mill'")&&grammar.includes("Schaftfräser ist für Helixfräsen freigegeben."),'helical end mill PASS'],
  [grammar.includes("ist für Helixfräsen nicht freigegeben"),'helical non-end-mill FAIL'],
  [ui.includes("tool.kind==='fiber-cutter'||tool.kind==='drill'"),'shared cylindrical geometry UI'],
  [ui.includes('tool.pointAngleDeg'),'drill point angle UI']
];
const failed=required.filter(([ok])=>!ok);
if(failed.length){for(const [,label] of failed)console.error(`FAIL 009-D: ${label}`);process.exit(1);}
console.log('PASS 009-D drill and fiber-cutter tool type expansion contract');
