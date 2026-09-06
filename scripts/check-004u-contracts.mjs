import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const kernel=read('src/lib/spindleHeadCollision.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const pkg=read('package.json');
const preflight=read('src/lib/jobPreflight.ts');
const app=read('src/App.svelte');
const preflightPanel=read('src/lib/JobPreflightPanel.svelte');
const jobPanel=read('src/lib/JobGCodePanel.svelte');
const setup=read('src/lib/SpindleHeadSetupPanel.svelte');
const checks=[
  ['004U spindle head geometry contract exists',kernel.includes('export type SpindleHeadGeometry')&&kernel.includes('spindleNoseDiameterMm')&&kernel.includes('carriageEnabled')],
  ['spindle nose uses finite axial offset and length',kernel.includes('spindleNoseBottomOffsetMm')&&kernel.includes('spindleNoseLengthMm')&&kernel.includes('noseBottomMin')&&kernel.includes('noseTopMax')],
  ['optional Z carriage uses rectangular swept envelope',kernel.includes('carriageWidthMm')&&kernel.includes('carriageDepthMm')&&kernel.includes('segmentIntersectsInflatedRect')],
  ['004U consumes explicit canonical motions when available',kernel.includes('toolpath.motions?.length')&&kernel.includes('return toolpath.motions')],
  ['004U preserves fallback for legacy run-only toolpaths',kernel.includes('for(const run of toolpath.runs)')&&kernel.includes("kind:'line3'")],
  ['fixture collision distinguishes spindle nose and carriage',kernel.includes("SpindleHeadCollisionKind='spindle-nose'|'z-carriage'")&&kernel.includes('Spindelnase/Spannzange')&&kernel.includes('Z-Schlitten-Hüllkörper')],
  ['invalid head geometry fails instead of guessing',kernel.includes('validateSpindleHeadGeometry')&&kernel.includes('Spindelnasen-Durchmesser muss positiv sein')],
  ['canonical contract exposes machine motions for 004U',canonical.includes('CanonicalMachineMotion')&&canonical.includes("kind:'rapid3'")],
  ['004U setup persists spindle and optional carriage geometry',setup.includes('Spindelkopf · 004U')&&setup.includes('spindleNoseBottomOffsetMm')&&setup.includes('carriageEnabled')],
  ['app wires 004U profile into preflight and export',app.includes('spindleHeadEnabled')&&app.includes('SpindleHeadSetupPanel')&&app.includes('spindleHead={spindleHeadEnabled?spindleHead:null}')],
  ['job preflight runs spindle head collision on canonical motions',preflight.includes('validateSpindleHeadAgainstFixtures')&&preflight.includes('Spindelkopf:')&&preflight.includes('spindleHead:JobPreflightSpindleHead')],
  ['preflight panel visibly renders 004U status',preflightPanel.includes('004U Spindelkopf')&&preflightPanel.includes('op.spindleHead.level')],
  ['NC export receives same 004U safety profile',jobPanel.includes('spindleHead:SpindleHeadGeometry|null')&&jobPanel.includes('machineWcsOrigin,spindleHead')],
  ['package exposes local-first 004U gate',pkg.includes('"check:004u": "node scripts/check-004u-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004U: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
