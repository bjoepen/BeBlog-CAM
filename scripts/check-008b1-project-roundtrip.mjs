import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { acceptanceCase } from './acceptance/harness.mjs';

const outDir = '.acceptance/008b1';
fs.rmSync(outDir, { recursive: true, force: true });

execFileSync('pnpm', [
  'exec', 'tsc',
  'scripts/acceptance/008b1-project-roundtrip.ts',
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
const output = execFileSync('node', [`${outDir}/scripts/acceptance/008b1-project-roundtrip.js`], { encoding: 'utf8' });
const result = JSON.parse(output);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

acceptanceCase('008B1 project save/load round-trip', () => {
  if (result.serialized !== result.reserialized) {
    throw new Error('serialize -> parse -> serialize is not byte-stable');
  }
  if (!same(result.project, result.loadedSnapshot)) {
    throw new Error('loaded project differs from the saved project');
  }
  if (result.loadedSnapshot.format !== 'beblog-cam-project' || result.loadedSnapshot.version !== 1) {
    throw new Error('project format/version changed during round-trip');
  }
  if (result.loadedSnapshot.source.path !== '/fixtures/008b1-reference.dxf' || result.loadedSnapshot.source.fileName !== '008b1-reference.dxf') {
    throw new Error('source reference changed during round-trip');
  }
});

acceptanceCase('008B1 complete project state preservation', () => {
  const loaded = result.loadedSnapshot;
  if (!same(result.project.setup, loaded.setup)) throw new Error('setup changed during round-trip');
  if (!same(result.project.operationsProject, loaded.operationsProject)) throw new Error('operations project changed during round-trip');
  if (loaded.operationsProject.operations.length !== 2) throw new Error(`expected two operations, got ${loaded.operationsProject.operations.length}`);
  if (loaded.operationsProject.activeOperationId !== '008b1-drill') throw new Error('active operation was not preserved');
  const [contour, drill] = loaded.operationsProject.operations;
  if (contour.tool.id !== '008b1-mill-4' || contour.contourIds?.join(',') !== '0') throw new Error('nested contour/tool state was not preserved');
  if (drill.tool.id !== '008b1-drill-6' || drill.curveIds?.join(',') !== '4,5') throw new Error('nested drill/tool state was not preserved');
});

acceptanceCase('008B1 loaded project isolation', () => {
  if (result.originalBeforeMutation !== result.originalAfterLoadedMutation) {
    throw new Error('mutating the loaded project changed the original project state');
  }
});

fs.rmSync(outDir, { recursive: true, force: true });
if (!process.exitCode) {
  console.log('PASS 008B1 project round-trip: a complete representative project survives serialize -> parse -> serialize byte-stably and loads as a detached state copy.');
}
