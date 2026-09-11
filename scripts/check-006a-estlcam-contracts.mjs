import fs from 'node:fs';
import ts from 'typescript';

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

// Architectural/static boundary checks.
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
assert(job.includes('let spindleRunning=false'),'Overall job must track spindle running state across operation boundaries.');
assert(job.includes('let activeSpindleRpm:number|null=null'),'Overall job must track active spindle RPM.');
assert(job.includes('if(!spindleRunning){'),'Spindle must only be started when it is not already running.');
assert(job.includes('}else if(activeSpindleRpm!==spindleRpm){'),'Same-tool RPM changes must update speed without a redundant spindle restart.');
assert(job.includes("lines.push(`S${spindleRpm}`)"),'RPM-only change must emit S without M3.');
assert(job.includes('spindleRunning=false;')&&job.includes('activeSpindleRpm=null;'),'Tool change must reset spindle state after M5.');
assert(panel.includes('Estlcam erhält einen echten M6-Werkzeugwechsel'),'UI must describe Estlcam-specific M6 behavior.');
assert(architecture.includes('Probing und Antasten gehören zur Maschinensteuerung'),'Architecture must keep probing in the controller boundary.');
assert(architecture.includes('Estlcam ist das erste praktische Produktionsziel'),'Architecture must identify Estlcam as the first practical production target.');

// Execute the real TypeScript postprocessor against a representative two-tool job.
const transpiled=ts.transpileModule(post,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const moduleUrl=`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {postProcessEstlcam}=await import(moduleUrl);

const fixture=`( BeBlog CAM 004T )
G21
G90
G17
G0 Z5.000
G0 X0.000 Y0.000
( Bearbeitung 1/2 · Kontur )
M3 S12000
G1 X10.000 Y0.000 Z-1.000 F300.000
M5
( Werkzeugwechsel 1 )
M0 ( Werkzeug 3mm Bohrer · Ø3.000 mm einsetzen und bestaetigen )
G0 Z8.000
G0 X20.000 Y20.000
( Bearbeitung 2/2 · Bohren )
M3 S9000
G1 X20.000 Y20.000 Z-4.000 F120.000
M5
M30
`;
const result=postProcessEstlcam(fixture);
assert(result.ok,`fixture must post successfully: ${result.errors.join(' | ')}`);
const lines=result.code.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
assert(lines.includes('M6'),'two-tool fixture must contain M6.');
assert(!lines.some(line=>/^M0\b/i.test(line)),'tool-change M0 must be consumed for Estlcam.');
assert(!lines.some(line=>/^M30\b/i.test(line)),'M30 must not reach Estlcam.');
assert(!lines.some(line=>/^T\d+/i.test(line)||/^M6\s+/i.test(line)),'Estlcam tool change must not emit T or M6 parameters.');
assert(lines.includes('S12000')&&lines.includes('M3'),'spindle speed and M3 must both be present.');
assert(!lines.some(line=>/^M3\s+S/i.test(line)||/^S\S+\s+M3/i.test(line)),'Estlcam must not combine spindle speed and M3 on one line.');
assert(lines.filter(line=>/^M6$/i.test(line)).length===1,'fixture must contain exactly one tool change.');
assert(lines.filter(line=>/^G/i.test(line)).every(line=>/^G[0-3]\b/i.test(line)),'only G0-G3 may reach Estlcam.');

const invalidTool=postProcessEstlcam('M6 T2\n');
assert(!invalidTool.ok,'M6 with T parameter must fail closed.');

console.log('006A contract PASS: Estlcam output is dialect-safe; overall-job spindle state is preserved across same-tool operations and reset only for tool changes.');
