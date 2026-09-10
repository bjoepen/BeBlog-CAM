import fs from 'node:fs';

const post=fs.readFileSync(new URL('../src/lib/postprocessors.ts',import.meta.url),'utf8');
const job=fs.readFileSync(new URL('../src/lib/jobGcode.ts',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../src/lib/JobGCodePanel.svelte',import.meta.url),'utf8');
const architecture=fs.readFileSync(new URL('../docs/ARCHITECTURE.md',import.meta.url),'utf8');

function assert(condition,message){
  if(!condition){
    console.error(`006A contract FAIL: ${message}`);
    process.exit(1);
  }
}

assert(post.includes("/^\\(\\s*Werkzeugwechsel\\b/i"),'Estlcam must recognize the controller-neutral tool-change marker.');
assert(post.includes("out.push('M6')"),'Estlcam must emit a native M6 tool change.');
assert(post.includes('Estlcam M6 wird ohne T- oder Zusatzparameter ausgegeben'),'M6 must reject T/additional parameters.');
assert(post.includes("line.match(/^M0?3\\s+S"),'M3 S... must be normalized for Estlcam.');
assert(post.includes("out.push(`S${m[1]}`,'M3')"),'Estlcam spindle speed and M3 must be emitted on separate lines.');
assert(post.includes("if(/^M30\\b/i.test(line)){removedLines++;continue;}"),'Unsupported M30 must not reach Estlcam.');
assert(post.includes("const motion=normalizeMotion(line)"),'Estlcam must preserve the existing G0-G3 motion stream rather than reconstruct geometry.');

assert(job.includes("`( Werkzeugwechsel ${toolChangeCount} )`"),'Raw job must retain its controller-neutral tool-change marker.');
assert(job.includes("`M0 ( Werkzeug ${next.tool.name}"),'Raw job must retain the manual neutral pause; M6 belongs to the postprocessor.');
assert(!job.includes("'M6'"),'Job motion generator must not become Estlcam-specific.');

assert(panel.includes('Estlcam erhält einen echten M6-Werkzeugwechsel'),'UI must describe Estlcam-specific M6 behavior.');
assert(architecture.includes('Probing und Antasten gehören zur Maschinensteuerung'),'Architecture must keep probing in the controller boundary.');
assert(architecture.includes('Estlcam ist das erste praktische Produktionsziel'),'Architecture must identify Estlcam as the first practical production target.');

console.log('006A contract PASS: Estlcam output remains a dialect translation of the approved job and emits native M6 tool changes.');
