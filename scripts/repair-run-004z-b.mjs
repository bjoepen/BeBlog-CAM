import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const path='scripts/apply-004z-b-island-semantics.mjs';
let text=fs.readFileSync(path,'utf8');
text=text.replaceAll('${planar.','\\${planar.');
fs.writeFileSync(path,text);
await import(`${pathToFileURL(process.cwd()+'/'+path).href}?run=${Date.now()}`);
