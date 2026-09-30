import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outDir = '.acceptance/010f6';
try {
  execFileSync('pnpm', ['exec', 'tsc', 'scripts/acceptance/010f6-canonical-toolpath-package.ts', '--outDir', outDir,
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2022', '--skipLibCheck',
    '--noEmitOnError', 'true'], { stdio: 'inherit' });
  fs.writeFileSync(`${outDir}/package.json`, '{"type":"commonjs"}\n');
  execFileSync('node', [`${outDir}/scripts/acceptance/010f6-canonical-toolpath-package.js`], { stdio: 'inherit' });
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
