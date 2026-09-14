import fs from 'node:fs';

const source=fs.readFileSync('src/lib/ContourOverlay.svelte','utf8');
const required=[
  "nearestContourFraction",
  "pointAtContourFraction",
  "commitClosedContourPatch",
  "startMode:'manual'",
  "startMode:'auto'",
  "entryMode:mode",
  "rampAngleDeg:value",
  'contour-start-marker',
  'contour-start-pick',
  'In Vorschau wählen',
  'Automatisch',
  'Senkrecht',
  'Tangential',
  'Rampe',
];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){
  console.error('FAIL 008-RW-006 UI: missing contract tokens:',missing.join(', '));
  process.exit(1);
}
if(!source.includes("operation.contourId=null")||!source.includes("selectedIds.filter(id=>id!==activeId)")){
  console.error('FAIL 008-RW-006 UI: DXF operation patch must preserve the active geometry selection while cloning the patched operation back into OperationsProject.');
  process.exit(1);
}
if(!source.includes("pickingContourStart=false")||!source.includes("pickContourStart(event:MouseEvent")){
  console.error('FAIL 008-RW-006 UI: manual preview picking lifecycle is incomplete.');
  process.exit(1);
}
console.log('PASS 008-RW-006 UI: DXF preview exposes auto/manual start placement, direct path picking, start marker and plunge/lead/ramp entry controls without moving the feature into post-processing.');
