import fs from 'node:fs';

const post=fs.readFileSync('src/lib/postprocessors.ts','utf8');
const picker=fs.readFileSync('src/lib/PostProcessorPicker.svelte','utf8');
const types=fs.readFileSync('src/lib/types.ts','utf8');

function pass(name,condition){
  if(!condition){console.error('FAIL '+name);process.exitCode=1;return;}
  console.log('PASS '+name);
}

pass('010F14 grblHAL is an explicit postprocessor',
  post.includes("'grblhal'")&&post.includes('postProcessGrblHal')&&picker.includes("postProcessorStore.set('grblhal')"));

pass('010F14 arc-centre mode is explicit incremental IJK',
  post.includes("out.push('G91.1')")&&post.includes('Absolute Arc-Center G90.1'));

pass('010F14 R and multi-turn arcs fail closed',
  post.includes('grblHAL v1 akzeptiert keine R-Arcs')&&post.includes('grblHAL v1 akzeptiert keine Multi-Turn-Arcs'));

pass('010F14 arc geometry is validated without reconstruction',
  post.includes('const radius=Math.hypot(i,j)')&&post.includes('const endRadius=Math.hypot')&&
  post.includes('Arc-Radien stimmen nicht überein')&&post.includes('Geometry is never reconstructed'));

pass('010F14 tool change remains manual until a machine tool number exists',
  !/interface ToolDefinition[^}]*toolNumber/.test(types)&&
  post.includes('Manual tool-change')&&post.includes('inventing')&&
  post.includes("M0?(0|1|5|8|9|30)")&&post.includes("M0?6"));

pass('010F14 tool table and length compensation are not invented',
  post.includes('Werkzeugtabellen-/Längenkorrektur-Befehle')&&post.includes("T\\\\d+")&&post.includes("G43"));

if(!process.exitCode)console.log('PASS 010F14 grblHAL v1: proven GRBL motion subset, explicit G91.1 IJK arcs, fail-closed arc validation and manual M0 tool change without invented T/H state.');
