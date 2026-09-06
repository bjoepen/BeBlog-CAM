import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const collision=read('src/lib/toolAssemblyCollision.ts');
const stock=read('src/lib/stockSimulation.ts');
const pkg=read('package.json');
const checks=[
  ['tool assembly geometry contract exists',collision.includes('export type ToolAssemblyGeometry')&&collision.includes('cuttingLengthMm')&&collision.includes('stickoutMm')&&collision.includes('holderDiameterMm')],
  ['collision kernel validates canonical toolpath against rest stock',collision.includes('validateToolAssemblyAgainstRestStock')&&collision.includes('previousOperations:StockSimulationOperation[]')&&collision.includes('toolpath:CanonicalToolpath')],
  ['004Q reuses deterministic 004P stock truth',collision.includes('simulateStockHeightfield')&&stock.includes('export function simulateStockHeightfield')],
  ['tool reach is a hard failure',collision.includes('Werkzeugreichweite überschritten')&&collision.includes('depth>assembly.stickoutMm')],
  ['cutting length overrun is surfaced as warning',collision.includes('tiefer als die definierte Schneidenlänge')&&collision.includes('depth>assembly.cuttingLengthMm')],
  ['holder collision checks annulus outside cutter radius',collision.includes('distance<=toolRadius')&&collision.includes('distance>holderRadius')&&collision.includes('surfaceZ>holderNoseZ')],
  ['holder collision becomes explicit failure',collision.includes('Halter kollidiert im 2.5D-Reststockmodell')&&collision.includes('collisionCells>0')],
  ['unsupported bottom-zero setup fails instead of guessing',collision.includes("wcs.z!=='top'")&&collision.includes('nur mit Z-Null auf Rohlingoberseite freigegeben')],
  ['package exposes local-first 004Q gate',pkg.includes('"check:004q": "node scripts/check-004q-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004Q: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
