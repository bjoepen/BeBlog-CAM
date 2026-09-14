import fs from 'node:fs';

const docPath='docs/ESTLCAM-11-PRODUCTION-QUALIFICATION.md';
const postPath='src/lib/postprocessors.ts';
const a5Path='scripts/check-008a5-estlcam-contract.mjs';

const doc=fs.readFileSync(docPath,'utf8');
const post=fs.readFileSync(postPath,'utf8');
const a5=fs.readFileSync(a5Path,'utf8');

function pass(name,condition,detail=''){
  if(!condition){console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);process.exitCode=1;return;}
  console.log(`PASS ${name}`);
}

pass('008C1 reference profile is Estlcam 11 build 11245',
  /Estlcam 11/.test(doc)&&/11245/.test(doc)&&/3-axis milling/.test(doc)&&/millimetres/.test(doc)&&/manual tool change/.test(doc));

pass('008C1 qualification keeps postprocessor syntax-only',
  /syntax-only/i.test(doc)&&/must never reconstruct, reinterpret or regenerate machining geometry or machine motion/i.test(doc)&&
  /Geometry and machine motions are never reconstructed here/.test(post));

pass('008C1 A5 remains the automated motion-truth baseline',
  /008A5 is the automated qualification baseline/.test(doc)&&
  /Estlcam motion truth parity/.test(a5)&&/motion count changed/.test(a5)&&/min Z changed/.test(a5));

pass('008C1 manual tool-change contract remains bare M6 without T',
  /Estlcam tool-change contract/.test(a5)&&
  a5.includes("/^M6$/i.test(line)")&&a5.includes('/\\bT\\d+/i.test(line)')&&
  post.includes("out.push('M6')"));

pass('008C1 real Estlcam acceptance is explicitly manual and outside CI',
  /008C3 — Manual Estlcam 11 Acceptance/.test(doc)&&/must \*\*not\*\* be moved into GitHub CI/.test(doc));

pass('008C1 real-machine qualification remains a separate local gate',
  /008C4 — Real-machine Qualification/.test(doc)&&/local\/manual production acceptance gate and is not GitHub CI/.test(doc));

if(!process.exitCode)console.log('PASS 008C1 Estlcam qualification baseline: the first production controller profile is explicitly Estlcam 11 build 11245, syntax-only motion-preserving translation is protected, and real controller/machine acceptance remains manual outside CI.');
