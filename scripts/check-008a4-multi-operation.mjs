import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  acceptanceCase,
  assertArcRadiusConsistency,
  assertNoXyRapidBelow,
  ncStats,
} from './acceptance/harness.mjs';

const outDir = '.acceptance/008a4';
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync('pnpm', [
  'exec', 'tsc',
  'scripts/acceptance/008a4-multi-operation.ts',
  '--outDir', outDir,
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--target', 'es2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--allowJs',
  '--noEmitOnError', 'true',
], { stdio: 'inherit' });

fs.writeFileSync(`${outDir}/package.json`, '{"type":"commonjs"}\n');
const output = execFileSync('node', [`${outDir}/scripts/acceptance/008a4-multi-operation.js`], { encoding: 'utf8' });
const result = JSON.parse(output);

acceptanceCase('008A4 combined multi-operation job', () => {
  if (!result.job.ok) throw new Error(result.job.errors.join(' | '));
  if (result.job.operationCount !== 4) throw new Error(`expected four operations, got ${result.job.operationCount}`);
  if (result.job.toolChangeCount !== result.expectedToolChanges) {
    throw new Error(`expected ${result.expectedToolChanges} tool changes, got ${result.job.toolChangeCount}`);
  }
  if (result.job.lineCount <= 0) throw new Error('combined job emitted no NC lines');
  assertNoXyRapidBelow(result.job.code, result.safeZMm);
  assertArcRadiusConsistency(result.job.code);
  const stats = ncStats(result.job.code);
  if (stats.motionCount <= 0) throw new Error('combined job emitted no machine motion');
  if (stats.minZ === null || stats.minZ >= 0) throw new Error(`combined job never cuts below Z0 (minZ=${stats.minZ})`);
});

acceptanceCase('008A4 operation order and tool transitions', () => {
  const expected = [
    ['Planen A4', 'a4-facing'],
    ['Tasche A4', 'a4-pocket'],
    ['Bohren A4', 'a4-drill'],
    ['Kontur A4', 'a4-contour'],
  ];
  if (result.operationIds.join(',') !== expected.map(([, id]) => id).join(',')) {
    throw new Error(`operation order changed unexpectedly: ${result.operationIds.join(', ')}`);
  }
  let cursor = -1;
  for (const [name] of expected) {
    const next = result.job.code.indexOf(name, cursor + 1);
    if (next < 0) throw new Error(`combined NC output is missing operation marker ${name}`);
    if (next <= cursor) throw new Error(`operation marker order is invalid at ${name}`);
    cursor = next;
  }
});

fs.rmSync(outDir, { recursive: true, force: true });
if (!process.exitCode) {
  console.log('PASS 008A4 multi-operation acceptance: one combined job preserves operation order, safe motion and three real tool transitions across facing, pocket, drilling and contour production paths.');
}
