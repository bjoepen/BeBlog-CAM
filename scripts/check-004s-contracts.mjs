import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const machine=read('src/lib/machineEnvelope.ts');
const canonical=read('src/lib/canonicalToolpath.ts');
const app=read('src/App.svelte');
const setup=read('src/lib/MachineSetupPanel.svelte');
const preflight=read('src/lib/jobPreflight.ts');
const panel=read('src/lib/JobPreflightPanel.svelte');
const job=read('src/lib/jobGcode.ts');
const jobPanel=read('src/lib/JobGCodePanel.svelte');
const pkg=read('package.json');
const checks=[
  ['machine envelope contract exists',machine.includes('export type MachineEnvelope')&&machine.includes('minX:number')&&machine.includes('maxZ:number')],
  ['004S models WCS origin in machine coordinates',machine.includes('export type MachineWcsOrigin')&&machine.includes('origin.x+point.x')&&machine.includes('origin.z+point.z')],
  ['hard machine limit violation becomes FAIL',machine.includes('Maschinenarbeitsraum überschritten')&&machine.includes("kind:'limit'")&&machine.includes('errors.push')],
  ['soft-limit warning margin is independent from hard failure',machine.includes('warningMarginMm')&&machine.includes("kind:'margin'")&&machine.includes('Warnabstand unterschritten')],
  ['canonical explicit machine motions are preferred when available',machine.includes('toolpath.motions')&&machine.includes('usesExplicitMotions')&&canonical.includes('CanonicalMachineMotion')],
  ['fallback checks canonical runs and entry exit spatial motions',machine.includes("source:'run'")&&machine.includes("source:'entry'")&&machine.includes("source:'exit'")],
  ['fallback never pretends complete rapid coverage',machine.includes('Keine vollständige canonical motions-Kette vorhanden')],
  ['safe Z is checked against machine Z travel',machine.includes("source:'safe-z'")&&machine.includes('z:safeZMm')],
  ['invalid envelope data fails instead of guessing',machine.includes('benötigt endliche Maschinenlimits')&&machine.includes('positive X/Y/Z-Ausdehnung')],
  ['machine setup is explicit and optional',app.includes('machineEnvelopeEnabled=false')&&app.includes('MachineSetupPanel')&&setup.includes('Sicherheitsrelevant')],
  ['job preflight consumes machine envelope and WCS machine origin',preflight.includes('machineEnvelope?:MachineEnvelope|null')&&preflight.includes('validateMachineEnvelope({toolpath:canonicalToolpath')&&preflight.includes('machineEnvelope:JobPreflightMachineEnvelope')],
  ['preflight panel exposes visible 004S PASS WARN FAIL status',panel.includes('004S Maschinenraum')&&panel.includes('op.machineEnvelope.level')],
  ['NC export reuses machine-aware preflight',job.includes('machineEnvelope?:MachineEnvelope|null')&&job.includes('preflight=validateJob(args)')&&jobPanel.includes('machineEnvelope,machineWcsOrigin')],
  ['package exposes local-first 004S gate',pkg.includes('"check:004s": "node scripts/check-004s-contracts.mjs"')],
];
let failed=false;for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 004S: ${label}`);if(!ok)failed=true;}if(failed)process.exit(1);
