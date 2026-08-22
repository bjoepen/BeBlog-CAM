import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const svgPath = resolve('public/cnc-floh.svg');
const pngPath = resolve('public/cnc-floh.png');
const svg = await readFile(svgPath, 'utf8');
const match = svg.match(/href=["']data:image\/png;base64,([^"']+)["']/);

if (!match) {
  throw new Error('public/cnc-floh.svg contains no embedded PNG image');
}

await writeFile(pngPath, Buffer.from(match[1].replace(/\s+/g, ''), 'base64'));
console.log('CNC-Floh: public/cnc-floh.png erzeugt.');
