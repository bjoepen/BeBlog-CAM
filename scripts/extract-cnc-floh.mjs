import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const svgPath = resolve('public/cnc-floh.svg');
const pngPath = resolve('public/cnc-floh.png');
const svg = await readFile(svgPath, 'utf8');

const marker = 'data:image/png;base64,';
const start = svg.indexOf(marker);

if (start === -1) {
  const imageTagIndex = svg.indexOf('<image');
  const preview = imageTagIndex >= 0
    ? svg.slice(imageTagIndex, imageTagIndex + 320).replace(/\s+/g, ' ')
    : svg.slice(0, 320).replace(/\s+/g, ' ');

  throw new Error(
    `public/cnc-floh.svg contains no embedded PNG data URL. ` +
    `Asset preview: ${preview}`
  );
}

const dataStart = start + marker.length;
const remainder = svg.slice(dataStart);
const match = remainder.match(/^([A-Za-z0-9+/=\r\n\t ]+)/);

if (!match) {
  throw new Error('Embedded PNG data URL was found, but contains no Base64 payload.');
}

const base64 = match[1].replace(/\s+/g, '');
const png = Buffer.from(base64, 'base64');

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (png.length < 8 || !png.subarray(0, 8).equals(pngSignature)) {
  throw new Error(
    `Embedded image data decoded (${png.length} Bytes), but it is not a valid PNG stream.`
  );
}

await writeFile(pngPath, png);
console.log(`CNC-Floh: public/cnc-floh.png erzeugt (${png.length} Bytes).`);
