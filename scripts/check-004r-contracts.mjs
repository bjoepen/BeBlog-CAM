import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fixture=read('src/lib/fixtureCollision.ts');
const assembly=read('src/lib/toolAssemblyCollision.ts');
const pkg=read('package.json');
const checks=[
  ['fixture volume contract exists',fixture.includes('export type FixtureVolume')&&fixture.includes('minX:number')&&fixture.includes('topZ:number')],
  ['fixture collision distinguishes cutter shank holder',fixture.includes("FixtureCollisionKind='cutter'|'shank'|'holder'")&&fixture.includes("kind:'cutter'")&&fixture.includes("kind:'shank'")&&fixture.includes("kind:'holder'" )],
  ['collision kernel consumes canonical toolpath and tool assembly',fixture.includes('validateToolAssemblyAgainstFixtures')&&fixture.includes('toolpath:CanonicalToolpath')&&fixture.includes('assembly:ToolAssemblyGeometry')],
  ['fixture XY test inflates footprint by active envelope radius',fixture.includes('segmentIntersectsInflatedRect')&&fixture.includes('fixture.minX-radius')&&fixture.includes('fixture.maxY+radius')],
  ['fixture collision is Z-aware',fixture.includes('intersectsZ')&&fixture.includes('cuttingTopZ')&&fixture.includes('holderNoseZ')],
  ['invalid fixture dimensions fail instead of guessing',fixture.includes('benötigt positive X/Y/Z-Ausdehnung')&&fixture.includes('ungültige Geometriewerte')],
  ['fixture collision becomes explicit failure',fixture.includes('Spannmittelkollision:')&&fixture.includes('errors.push')],
  ['004R reuses 004Q tool assembly truth',fixture.includes("from './toolAssemblyCollision'")&&assembly.includes('export type ToolAssemblyGeometry')],
  ['package exposes local-first 004R gate',pkg.includes('"check:004r": "node scripts/check-004r-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004R: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
