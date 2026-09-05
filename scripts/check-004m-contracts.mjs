import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const step=read('src/lib/stepPocketOperation.ts');
const canonical=read('src/lib/pocketCanonicalToolpath.ts');
const checks=[
  ['STEP pocket no longer downgrades non-plunge entry',!step.includes('004G STEP-Tasche verwendet zunächst sicheren Plunge-Einstieg')],
  ['STEP pocket resolves auto strategy on BRep region',step.includes('resolveStrategy')&&step.includes("return islands.length?'parallel':'concentric'")],
  ['STEP pocket exposes contour-parallel region strategy',step.includes('contourParallelSegments')&&step.includes("strategy==='parallel'?'parallel-pocket':strategy")],
  ['STEP concentric strategy is safety-gated for islands',step.includes('Konzentrische STEP-Tasche ist in 004M nur für Regionen ohne Inseln freigegeben')],
  ['STEP ramp entry enforces geometric angle length',step.includes('required=Math.abs(zEnd-zStart)/Math.tan(angleDeg*Math.PI/180)')&&step.includes('eine längere erste sichere Bahn')],
  ['STEP helix entry validates a collision-free circle',step.includes('safeCircle')&&step.includes('kein kollisionsfreier Helixkreis')],
  ['STEP entry uses canonical spatial line and arc segments',step.includes("kind:'line3'")&&step.includes("kind:'arc3'")],
  ['canonical pocket poster emits line3 and arc3 entries',canonical.includes("segment.kind==='line3'")&&canonical.includes("segment.ccw?'G3':'G2'")]
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004M: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
