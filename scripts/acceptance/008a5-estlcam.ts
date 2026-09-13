import fs from 'node:fs';
import { postProcessEstlcam } from '../../src/lib/postprocessors';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('008A5 requires the combined 008A4 NC source path.');

const source = fs.readFileSync(sourcePath, 'utf8');
const posted = postProcessEstlcam(source);

console.log(JSON.stringify({
  ok: posted.ok,
  errors: posted.errors,
  warnings: posted.warnings,
  code: posted.code,
  removedLines: posted.removedLines,
  transformedLines: posted.transformedLines,
}));
