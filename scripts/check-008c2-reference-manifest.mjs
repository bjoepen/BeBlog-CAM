import fs from 'node:fs';

const builder = fs.readFileSync('scripts/acceptance/008c2-reference-nc.ts', 'utf8');
const freezer = fs.readFileSync('scripts/freeze-008c2-reference.mjs', 'utf8');
const a4 = fs.readFileSync('scripts/acceptance/008a4-multi-operation.ts', 'utf8');
const a5 = fs.readFileSync('scripts/acceptance/008a5-estlcam.ts', 'utf8');

function pass(name, condition) {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

pass('008C2 reference builder reuses qualified A5 postprocessor', builder.includes("import { run008a5 } from './008a5-estlcam'") && a5.includes('postProcessEstlcam'));
pass('008C2 reference source remains A4 multi-operation fixture', a4.includes("id: 'a4-facing'") && a4.includes("id: 'a4-pocket'") && a4.includes("id: 'a4-drill'") && a4.includes("id: 'a4-contour'"));
pass('008C2 manifest records qualified controller profile', builder.includes("controller: 'Estlcam 11 build 11245'") && builder.includes("workflow: '3-axis milling / millimetres / manual tool change'"));
pass('008C2 builder records operation and tool-change expectations', builder.includes('operationIds') && builder.includes('expectedToolChanges') && builder.includes('actualToolChanges'));
pass('008C2 reference output is normalized with terminal newline', builder.includes("posted.code.endsWith('\\n')") && builder.includes('terminalCommand'));
pass('008C2 byte identity is frozen locally outside TypeScript production fixture', !builder.includes('node:crypto') && !builder.includes('Buffer.byteLength') && freezer.includes("createHash('sha256')") && freezer.includes('data.byteLength'));

if (!process.exitCode) console.log('PASS 008C2 reference manifest contract: the qualified A4/A5 builder stays platform-neutral while the local freezer records exact byte length and SHA-256 identity for the exported Estlcam reference.');
