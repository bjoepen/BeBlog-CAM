import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir = '.acceptance/008b2';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n');

execFileSync('pnpm', [
  'exec', 'tsc',
  'scripts/acceptance/008b2-project-fail-closed.ts',
  '--outDir', outDir,
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--target', 'es2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--noEmitOnError', 'true',
], { stdio: 'inherit' });

const output = execFileSync('node', [path.join(outDir, 'scripts/acceptance/008b2-project-fail-closed.js')], { encoding: 'utf8' }).trim();
const results = JSON.parse(output);

function pass(name, condition, detail) {
  if (!condition) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

const byId = new Map(results.map(result => [result.id, result]));
const allRejected = results.length === 9 && results.every(result => result.rejected === true);
const exactMessages = results.every(result => typeof result.error === 'string' && result.error.startsWith(result.expected));

pass('008B2 malformed project rejection',
  ['malformed-json', 'non-object-root', 'wrong-format'].every(id => byId.get(id)?.rejected),
  JSON.stringify(results));
pass('008B2 unsupported version rejection',
  ['missing-version', 'newer-version', 'older-version'].every(id => byId.get(id)?.rejected),
  JSON.stringify(results));
pass('008B2 incomplete project rejection',
  ['missing-source', 'missing-setup', 'missing-operations'].every(id => byId.get(id)?.rejected),
  JSON.stringify(results));
pass('008B2 explicit fail-closed diagnostics', allRejected && exactMessages, JSON.stringify(results));

if (!process.exitCode) {
  console.log('PASS 008B2 project fail-closed contract: malformed, foreign, unsupported-version and structurally incomplete project files are rejected explicitly before project state can be accepted.');
}
