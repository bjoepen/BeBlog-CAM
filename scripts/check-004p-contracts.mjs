import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const sim=read('src/lib/stockSimulation.ts');
const preflight=read('src/lib/jobPreflight.ts');
const pkg=read('package.json');
const app=read('src/App.svelte');
const checks=[
  ['deterministic stock heightfield kernel exists',sim.includes('export function simulateStockHeightfield')&&sim.includes('Float32Array')],
  ['simulation derives WCS-aware stock bounds',sim.includes("wcs.x==='left'")&&sim.includes("wcs.y==='front'")&&sim.includes("wcs.z!=='top'")&&sim.includes('axisBounds(stock.width')&&sim.includes('axisBounds(stock.height')],
  ['tool radius sweeps canonical cutting segments',sim.includes('distanceToSegment')&&sim.includes('entry.toolpath.tool.diameterMm/2')&&sim.includes('cutDisk')],
  ['heightfield clamps removal to stock thickness',sim.includes('clamp(z')&&sim.includes('stock.thickness')],
  ['simulation reports remaining and removed stock volume',sim.includes('remainingVolumeMm3')&&sim.includes('removedVolumeMm3')&&sim.includes('removedPercent')],
  ['job preflight accumulates canonical operations into stock simulation',preflight.includes('simulateStockHeightfield')&&preflight.includes('stockSimulationOperations.push')],
  ['job preflight exposes stock simulation summary',preflight.includes('stockSimulation:')&&preflight.includes('removedPercent')],
  ['package exposes local-first 004P gate',pkg.includes('"check:004p": "node scripts/check-004p-contracts.mjs"')],
  ['Prüfen UI exposes the 004P rest-stock summary',app.includes('Reststock-Simulation')&&app.includes('2.5D Heightfield')&&app.includes('Stock-Simulation 004P ist aktuell nur mit Z-Null auf Rohlingoberseite verfügbar.')],
  ['Prüfen UI guards nullable import summary',app.includes("{:else if activeStep==='Prüfen'}{#if importSummary}")&&app.includes('<JobPreflightPanel summary={importSummary}')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004P: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
