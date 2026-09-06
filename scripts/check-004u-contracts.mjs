import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const kernel=read('src/lib/spindleHeadCollision.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const pkg=read('package.json');
const checks=[
  ['004U spindle head geometry contract exists',kernel.includes('export type SpindleHeadGeometry')&&kernel.includes('spindleNoseDiameterMm')&&kernel.includes('carriageEnabled')],
  ['spindle nose uses finite axial offset and length',kernel.includes('spindleNoseBottomOffsetMm')&&kernel.includes('spindleNoseLengthMm')&&kernel.includes('noseBottomMin')&&kernel.includes('noseTopMax')],
  ['optional Z carriage uses rectangular swept envelope',kernel.includes('carriageWidthMm')&&kernel.includes('carriageDepthMm')&&kernel.includes('segmentIntersectsInflatedRect')],
  ['004U consumes explicit canonical motions when available',kernel.includes('toolpath.motions?.length')&&kernel.includes('return toolpath.motions')],
  ['004U preserves fallback for legacy run-only toolpaths',kernel.includes('for(const run of toolpath.runs)')&&kernel.includes("kind:'line3'")],
  ['fixture collision distinguishes spindle nose and carriage',kernel.includes("SpindleHeadCollisionKind='spindle-nose'|'z-carriage'")&&kernel.includes('Spindelnase/Spannzange')&&kernel.includes('Z-Schlitten-Hüllkörper')],
  ['invalid head geometry fails instead of guessing',kernel.includes('validateSpindleHeadGeometry')&&kernel.includes('Spindelnasen-Durchmesser muss positiv sein')],
  ['canonical contract exposes machine motions for 004U',canonical.includes('CanonicalMachineMotion')&&canonical.includes("kind:'rapid3'")],
  ['package exposes local-first 004U gate',pkg.includes('"check:004u": "node scripts/check-004u-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004U: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
