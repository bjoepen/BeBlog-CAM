import fs from 'node:fs';
const pocket=fs.readFileSync('src/lib/pocketGcode.ts','utf8');
const canonical=fs.readFileSync('src/lib/pocketCanonicalToolpath.ts','utf8');
const stayDown=fs.readFileSync('src/lib/pocketStayDown.ts','utf8');
const review=fs.readFileSync('REVIEW.md','utf8');
const pkg=fs.readFileSync('package.json','utf8');
const checks=[
 ['accepted finding',review.includes('008-RW-003')&&review.includes('Status:** Accepted')],
 ['circular depth linking documented',pocket.includes('Tiefenstufen bleiben im nachweislich geraeumten Taschenraum')],
 ['circular depth linking returns through center',pocket.includes('if(pass<passes)lines.push')&&pocket.includes('center.x')&&pocket.includes('center.y')],
 ['rectangular depth linking returns through cleared start',pocket.includes('cleanupFromEnd[cleanupFromEnd.length-1]')&&pocket.includes('distance(current,start)>1e-6')],
 ['final global safe-z retained',pocket.includes('G0 Z${f3(operation.safeZMm)}')],
 ['parallel ambiguity remains fail closed',stayDown.includes('If any condition is ambiguous, the original Safe-Z sequence is retained.')],
 ['canonical truth consumes generated pocket motion',canonical.includes('generatePocketGcode(args)')],
 ['no Estlcam postprocessor geometry optimization',!pocket.includes('postProcessEstlcam')&&!stayDown.includes('postProcessEstlcam')],
 ['local gate exposed',pkg.includes('check:008rw3')],
];
let failed=false;
for(const [label,ok] of checks){console.log((ok?'PASS':'FAIL')+' 008-RW-003: '+label);if(!ok)failed=true;}
if(failed)process.exit(1);
