import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  acceptanceCase,
  assertArcRadiusConsistency,
  assertNcCommandsAllowed,
  assertNoXyRapidBelow,
  ncStats,
} from './acceptance/harness.mjs';

const outDir = '.acceptance/008a2';
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync('pnpm', [
  'exec', 'tsc',
  'scripts/acceptance/008a2-pipeline.ts',
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
const output = execFileSync('node', [`${outDir}/scripts/acceptance/008a2-pipeline.js`], { encoding: 'utf8' });
const cases = JSON.parse(output);

const expected = ['facing', 'contour', 'pocket', 'carve', 'drill', 'helix'];
if (cases.map((entry) => entry.name).join(',') !== expected.join(',')) {
  throw new Error(`008A2 fixture matrix changed unexpectedly: ${cases.map((entry) => entry.name).join(', ')}`);
}

for (const entry of cases) {
  acceptanceCase(`008A2 ${entry.name} raw job`, () => {
    if (!entry.job.ok) throw new Error(entry.job.errors.join(' | '));
    if (entry.job.operationCount !== 1) throw new Error(`expected one operation, got ${entry.job.operationCount}`);
    if (entry.job.lineCount <= 0) throw new Error('job emitted no NC lines');
    assertNoXyRapidBelow(entry.job.code, entry.safeZMm);
    assertArcRadiusConsistency(entry.job.code);
    const stats = ncStats(entry.job.code);
    if (stats.motionCount <= 0) throw new Error('job emitted no machine motion');
    if (stats.minZ === null || stats.minZ >= 0) throw new Error(`job never cuts below Z0 (minZ=${stats.minZ})`);
  });

  acceptanceCase(`008A2 ${entry.name} Estlcam`, () => {
    if (!entry.estlcam.ok) throw new Error(entry.estlcam.errors.join(' | '));
    assertNcCommandsAllowed(entry.estlcam.code, { g: [0, 1, 2, 3], m: [3, 5, 6, 8, 9, 10, 11] });
    assertNoXyRapidBelow(entry.estlcam.code, entry.safeZMm);
    assertArcRadiusConsistency(entry.estlcam.code);
    const stats = ncStats(entry.estlcam.code);
    if (stats.motionCount <= 0) throw new Error('Estlcam output emitted no machine motion');
  });
}

fs.rmSync(outDir, { recursive: true, force: true });
if (!process.exitCode) console.log('PASS 008A2 synthetic 2D/2.5D production acceptance: facing, contour, pocket, carve, drill and helix traverse the real Job -> Preflight -> 004T -> NC -> Estlcam path without external DXF/NC fixtures.');
