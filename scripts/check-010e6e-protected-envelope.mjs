import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir = '.acceptance/010e6e';
try {
  execFileSync('pnpm', ['exec', 'tsc', 'scripts/acceptance/010e6e-protected-envelope.ts', '--outDir', outDir,
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2022', '--skipLibCheck',
    '--noEmitOnError', 'true'], { stdio: 'inherit' });
  fs.writeFileSync(`${outDir}/package.json`, '{"type":"commonjs"}\n');
  execFileSync('node', [`${outDir}/scripts/acceptance/010e6e-protected-envelope.js`], { stdio: 'inherit' });
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
