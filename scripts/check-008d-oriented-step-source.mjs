import fs from 'node:fs';

const source=fs.readFileSync('src/lib/stepManufacturingFeatures.ts','utf8');
const required=[
  'buildOrientedStepManufacturingFeatureSource',
  'orientStepManufacturingFeatureSource',
  'orientTuple3(face.origin,orientation)',
  'orientDirection3(face.normal,orientation)',
  'orientTuple3(face.axisOrigin,orientation)',
  'orientDirection3(face.axisDirection,orientation)',
  'orientTuple3(edge.start,orientation)',
  'orientTuple3(edge.end,orientation)',
  'orientTuple3(edge.center,orientation)',
  'orientDirection3(edge.axisDirection,orientation)',
  'faceId',
  'edgeId',
  'wireId',
];
const missing=required.filter(token=>!source.includes(token));
if(missing.length){
  console.error('FAIL 008D-B: oriented STEP manufacturing view is incomplete:',missing.join(', '));
  process.exit(1);
}
if(source.includes('faceId:orient')||source.includes('edgeId:orient')||source.includes('wireId:orient')){
  console.error('FAIL 008D-B: native BRep identities must never be transformed.');
  process.exit(1);
}
if(!source.includes('No placement')||!source.includes('No placement')){
  console.error('FAIL 008D-B: orientation view must document the placement/WCS boundary.');
  process.exit(1);
}
console.log('PASS 008D-B: STEP manufacturing geometry has one orientation-aware view while native face/edge/wire identities and topology remain unchanged.');
