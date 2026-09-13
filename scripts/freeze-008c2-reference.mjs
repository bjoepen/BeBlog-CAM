import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const input = process.argv.slice(2).find((arg) => arg !== '--');
if (!input) {
  console.error('Usage: node scripts/freeze-008c2-reference.mjs <reference-file>');
  process.exit(2);
}

const resolved = path.resolve(input);
const data = fs.readFileSync(resolved);
const text = data.toString('utf8');
const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const toolChanges = lines.filter((line) => /^M6$/i.test(line)).length;
const terminalCommand = lines.at(-1) ?? null;

if (toolChanges !== 3) throw new Error(`Expected 3 bare M6 tool changes, got ${toolChanges}`);
if (lines.some((line) => /\bT\d+/i.test(line))) throw new Error('T parameter present in reference output');
if (terminalCommand !== 'M5') throw new Error(`Expected terminal M5, got ${terminalCommand ?? 'none'}`);

const manifest = {
  qualification: '008C2',
  controller: 'Estlcam 11 build 11245',
  workflow: '3-axis milling / millimetres / manual tool change',
  referenceFile: path.basename(resolved),
  expectedToolChanges: 3,
  actualToolChanges: toolChanges,
  lineCount: lines.length,
  byteLength: data.byteLength,
  sha256: createHash('sha256').update(data).digest('hex'),
  terminalCommand,
};

const manifestPath = `${resolved}.manifest.json`;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`PASS 008C2 reference frozen: ${resolved}`);
console.log(`PASS 008C2 manifest written: ${manifestPath}`);
console.log(`SHA-256 ${manifest.sha256}`);
console.log(`Bytes ${manifest.byteLength}`);
console.log(`Tool changes ${manifest.actualToolChanges}`);
