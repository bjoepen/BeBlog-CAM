import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { acceptanceCase, assertArcRadiusConsistency, assertNcCommandsAllowed, assertNoXyRapidBelow, ncStats } from './acceptance/harness.mjs';

const outDir = '.acceptance/008a5';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
execFileSync('pnpm', ['exec', 'tsc',
  'scripts/acceptance/008a4-multi-operation.ts',
  'scripts/acceptance/008a5-estlcam.ts',
  '--outDir', outDir, '--module', 'commonjs', '--moduleResolution', 'node',
  '--target', 'es2022', '--esModuleInterop', '--skipLibCheck', '--allowJs',
  '--noEmitOnError', 'true'], { stdio: 'inherit' });
fs.writeFileSync(`${outDir}/package.json`, '{"type":"commonjs"}\n');

const a4 = JSON.parse(execFileSync('node', [`${outDir}/scripts/acceptance/008a4-multi-operation.js`], { encoding: 'utf8' }));
if (!a4.job.ok) throw new Error(a4.job.errors.join(' | '));
const sourcePath = `${outDir}/008a4-combined.nc`;
fs.writeFileSync(sourcePath, a4.job.code);
const posted = JSON.parse(execFileSync('node', [`${outDir}/scripts/acceptance/008a5-estlcam.js`, sourcePath], { encoding: 'utf8' }));

acceptanceCase('008A5 Estlcam combined-job postprocess', () => {
  if (!posted.ok) throw new Error(posted.errors.join(' | '));
  assertNcCommandsAllowed(posted.code, { g: [0, 1, 2, 3], m: [3, 5, 6, 8, 9, 10, 11] });
  assertNoXyRapidBelow(posted.code, a4.safeZMm);
  assertArcRadiusConsistency(posted.code);
  if (posted.removedLines <= 0 || posted.transformedLines < a4.expectedToolChanges) throw new Error('Estlcam syntax translation was incomplete');
});

acceptanceCase('008A5 Estlcam motion truth parity', () => {
  const before = ncStats(a4.job.code);
  const after = ncStats(posted.code);
  if (before.motionCount !== after.motionCount) throw new Error(`motion count changed: ${before.motionCount} -> ${after.motionCount}`);
  if (before.minZ === null || after.minZ === null || Math.abs(before.minZ - after.minZ) > 1e-9) throw new Error(`min Z changed: ${before.minZ} -> ${after.minZ}`);
});

acceptanceCase('008A5 Estlcam tool-change contract', () => {
  const lines = posted.code.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.filter((line) => /^M6$/i.test(line)).length !== a4.expectedToolChanges) throw new Error('Estlcam M6 count does not match the A4 tool transitions');
  if (lines.some((line) => /^M0?0\b/i.test(line))) throw new Error('M0 survived tool-change translation');
  if (lines.some((line) => /\bT\d+/i.test(line))) throw new Error('T parameter present in Estlcam output');
  if (lines.some((line) => /^(G17|G20|G21|G40|G49|G54|G55|G56|G57|G58|G59|G80|G90|G91|M30)\b/i.test(line))) throw new Error('forbidden Estlcam modal/program-end command present');
  if (lines.at(-1) !== 'M5') throw new Error('Estlcam output does not terminate with M5');
});

acceptanceCase('008A5 Estlcam operation-order preservation', () => {
  let cursor = -1;
  for (const name of ['Planen A4', 'Tasche A4', 'Bohren A4', 'Kontur A4']) {
    const next = posted.code.indexOf(name, cursor + 1);
    if (next < 0 || next <= cursor) throw new Error(`operation order invalid at ${name}`);
    cursor = next;
  }
});

fs.rmSync(outDir, { recursive: true, force: true });
if (!process.exitCode) console.log('PASS 008A5 Estlcam contract: the 008A4 combined job preserves motion truth and operation order while three tool changes become bare M6 commands.');
