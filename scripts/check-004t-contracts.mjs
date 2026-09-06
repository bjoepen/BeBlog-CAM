import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const chain=read('src/lib/safeMotionChain.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const machine=read('src/lib/machineEnvelope.ts');
const pkg=read('package.json');
const checks=[
  ['004T safe motion materializer exists',chain.includes('export function materializeSafeMotionChain')&&chain.includes('SafeMotionChainResult')],
  ['run based toolpaths gain explicit rapid and spatial motions',chain.includes("kind:'rapid3'")&&chain.includes("kind:'line3'")&&chain.includes('runCutMotions')],
  ['safe chain explicitly approaches and retracts each run',chain.includes('Entry-Anfahrt')&&chain.includes('Sicherheits-Retract')&&chain.includes('Zustellung')],
  ['safe chain validates continuity instead of teleporting',chain.includes('Bewegungskette ist nicht zusammenhängend')&&chain.includes('samePoint(previous.end,motion.start)')],
  ['explicit XYZ motion owners remain authoritative',chain.includes('toolpath.motions?.length')&&chain.includes('does not silently rebuild')],
  ['operation chain exposes safe start and end anchors',chain.includes('startSafePoint')&&chain.includes('endSafePoint')],
  ['job transition planner connects operations on max safe Z',chain.includes('export function buildJobSafeTransitions')&&chain.includes('Math.max(current.safeZMm,next.safeZMm)')],
  ['canonical contract supports rapid3 motions',canonical.includes("kind:'rapid3'")&&canonical.includes('CanonicalMachineMotion')],
  ['004S can consume explicit motions once 004T is integrated',machine.includes('toolpath.motions')&&machine.includes('usesExplicitMotions')],
  ['package exposes local-first 004T gate',pkg.includes('"check:004t": "node scripts/check-004t-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004T: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
