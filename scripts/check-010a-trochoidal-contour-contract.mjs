import fs from 'node:fs';

const contract=fs.readFileSync(new URL('../docs/BUILD-010-A-TROCHOIDAL-CONTOUR-ROUGHING-CONTRACT.md',import.meta.url),'utf8');
const model=fs.readFileSync(new URL('../src/lib/trochoidalContourContract.ts',import.meta.url),'utf8');

const requiredContract=[
  'exactly one contour target',
  'mandatory ramp entry',
  'avoid sustained 100% cutter-width slotting',
  'No implementation may fall back to a conventional full-slot contour',
  'end mill only',
  'CanonicalToolpath',
  'no production toolpath generator is introduced'
];
for(const token of requiredContract)if(!contract.includes(token))throw new Error('010-A contract missing: '+token);

const requiredModel=[
  "TROCHOIDAL_CONTOUR_OPERATION_KIND = 'trochoidal-contour-roughing'",
  "TROCHOIDAL_CONTOUR_STRATEGY = 'trochoidal-contour'",
  "TROCHOIDAL_CONTOUR_ENTRY_MODE = 'ramp'",
  "contourId: number | null",
  "trochoidRadiusMm: number",
  "forwardStepMm: number",
  "operation.tool.kind !== 'end-mill'",
  "operation.entryMode !== TROCHOIDAL_CONTOUR_ENTRY_MODE"
];
for(const token of requiredModel)if(!model.includes(token))throw new Error('010-A model missing: '+token);

const forbidden=[
  'generateTrochoidal',
  'buildTrochoidalToolpath',
  "kind:'arc'",
  'G2 ',
  'G3 '
];
for(const token of forbidden)if(model.includes(token))throw new Error('010-A must not implement production toolpath generation: '+token);

console.log('010-A trochoidal contour contract: PASS');
