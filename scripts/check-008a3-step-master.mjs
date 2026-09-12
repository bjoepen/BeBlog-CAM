import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  acceptanceCase,
  assertArcRadiusConsistency,
  assertNcCommandsAllowed,
  assertNoXyRapidBelow,
  ncStats,
} from './acceptance/harness.mjs';

if (process.platform !== 'darwin') {
  throw new Error('008A3 native STEP acceptance currently requires macOS.');
}

const root = process.cwd();
const outDir = path.join(root, '.acceptance', '008a3');
const prefix = process.env.BEBLOG_OCCT_PREFIX || path.join(root, '.cache', 'occt', 'install');
const includeDir = path.join(prefix, 'include', 'opencascade');
const libDir = path.join(prefix, 'lib');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(includeDir) || !fs.existsSync(libDir)) {
  execFileSync('bash', ['scripts/build-occt-macos.sh'], {
    stdio: 'inherit',
    env: { ...process.env, BEBLOG_OCCT_PREFIX: prefix },
  });
}

const generator = path.join(outDir, '008a3-master-step');
const stepPath = path.join(outDir, '008a3-master.step');
execFileSync('clang++', [
  '-std=c++17',
  'scripts/acceptance/008a3-master-step.cpp',
  '-I', includeDir,
  '-L', libDir,
  `-Wl,-rpath,${libDir}`,
  '-lTKernel', '-lTKMath', '-lTKG2d', '-lTKG3d', '-lTKGeomBase', '-lTKBRep',
  '-lTKGeomAlgo', '-lTKTopAlgo', '-lTKPrim', '-lTKBO', '-lTKXSBase', '-lTKDE', '-lTKDESTEP',
  '-o', generator,
], { stdio: 'inherit' });
execFileSync(generator, [stepPath], { stdio: 'inherit' });

const summaryText = execFileSync('cargo', [
  'run', '--quiet',
  '--manifest-path', 'src-tauri/Cargo.toml',
  '--features', 'occt-native',
  '--example', 'inspect_step_acceptance',
  '--', stepPath,
], {
  encoding: 'utf8',
  env: { ...process.env, BEBLOG_OCCT_PREFIX: prefix, DYLD_LIBRARY_PATH: libDir },
});
const summary = JSON.parse(summaryText.trim());

acceptanceCase('008A3 native OCCT import', () => {
  if (!summary.nativeBrep) throw new Error('nativeBrep is false');
  if (!(summary.faces > 0 && summary.edges > 0 && summary.solids > 0)) throw new Error('BRep topology is incomplete');
  if (!Array.isArray(summary.manufacturingFaces) || summary.manufacturingFaces.length !== summary.faces) throw new Error('manufacturing face map is incomplete');
  if (!Array.isArray(summary.manufacturingEdges) || summary.manufacturingEdges.length !== summary.edges) throw new Error('manufacturing edge map is incomplete');
  if (!Array.isArray(summary.displayVertices) || summary.displayVertices.length === 0) throw new Error('display triangulation is empty');
  if (!Array.isArray(summary.displayFaceIds) || summary.displayFaceIds.length * 9 !== summary.displayVertices.length) throw new Error('triangle-to-face map is inconsistent');
});

acceptanceCase('008A3 STEP master feature mix', () => {
  const kinds = new Set((summary.manufacturingFaces ?? []).map((face) => face.kind));
  if (!kinds.has('plane')) throw new Error('master has no planar face');
  if (!kinds.has('cylinder')) throw new Error('master has no cylindrical hole face');
  if (![...kinds].some((kind) => kind !== 'plane' && kind !== 'cylinder')) throw new Error(`master has no dedicated curved 3D face (${[...kinds].join(', ')})`);
  const radii = (summary.manufacturingFaces ?? []).filter((face) => face.kind === 'cylinder').map((face) => face.radiusMm).filter(Number.isFinite);
  if (radii.filter((radius) => Math.abs(radius - 3) <= 0.01).length < 2) throw new Error('master does not expose two Ø6 cylindrical hole faces');
});

const jsOut = path.join(outDir, 'ts');
execFileSync('pnpm', [
  'exec', 'tsc',
  'scripts/acceptance/008a3-pipeline.ts',
  '--outDir', jsOut,
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--target', 'es2022',
  '--esModuleInterop',
  '--skipLibCheck',
  '--allowJs',
  '--noEmitOnError', 'true',
], { stdio: 'inherit' });
fs.writeFileSync(path.join(jsOut, 'package.json'), '{"type":"commonjs"}\n');
const require = createRequire(import.meta.url);
const pipeline = require(path.join(jsOut, 'scripts', 'acceptance', '008a3-pipeline.js'));
const cases = pipeline.run008a3({
  kind: 'step',
  fileName: '008a3-master.step',
  backend: summary.backend,
  status: 'ready',
  entities: { faces: summary.faces, edges: summary.edges, solids: summary.solids },
  brep: summary,
  note: summary.note,
});

const expected = ['step-contour', 'step-pocket', 'step-drill', 'z-level', 'surface-finishing'];
if (cases.map((entry) => entry.name).join(',') !== expected.join(',')) {
  throw new Error(`008A3 fixture matrix changed unexpectedly: ${cases.map((entry) => entry.name).join(', ')}`);
}

for (const entry of cases) {
  acceptanceCase(`008A3 ${entry.name} raw job`, () => {
    if (!entry.job.ok) throw new Error(entry.job.errors.join(' | '));
    if (entry.job.operationCount !== 1) throw new Error(`expected one operation, got ${entry.job.operationCount}`);
    if (entry.job.lineCount <= 0) throw new Error('job emitted no NC lines');
    assertNoXyRapidBelow(entry.job.code, entry.safeZMm);
    assertArcRadiusConsistency(entry.job.code);
    const stats = ncStats(entry.job.code);
    if (stats.motionCount <= 0) throw new Error('job emitted no machine motion');
  });

  acceptanceCase(`008A3 ${entry.name} Estlcam`, () => {
    if (!entry.estlcam.ok) throw new Error(entry.estlcam.errors.join(' | '));
    assertNcCommandsAllowed(entry.estlcam.code, { g: [0, 1, 2, 3], m: [3, 5, 6, 8, 9, 10, 11] });
    assertNoXyRapidBelow(entry.estlcam.code, entry.safeZMm);
    assertArcRadiusConsistency(entry.estlcam.code);
    if (ncStats(entry.estlcam.code).motionCount <= 0) throw new Error('Estlcam output emitted no machine motion');
  });
}

if (!process.exitCode) {
  console.log('PASS 008A3 STEP master acceptance: one deterministic native OCCT model covers STEP contour, STEP pocket, STEP drilling, Z-Level and 3D finishing through Preflight -> 004T -> NC -> Estlcam.');
}
