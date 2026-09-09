import fs from 'node:fs';
function replace(path,from,to,label){let text=fs.readFileSync(path,'utf8');if(!text.includes(from))throw new Error(`${path}: ${label}`);text=text.replace(from,to);fs.writeFileSync(path,text);}

replace('src/lib/jobPreflight.ts',
"import { generateContourGcode } from './gcode';",
"import { generateContourGcode, buildDxfContourCanonicalState } from './gcode';",
'add DXF canonical state import');
replace('src/lib/jobPreflight.ts',
"import { canonicalContourToolpathFromGcode } from './contourCanonicalToolpath';\n",
'',
'remove DXF gcode reparse import');
replace('src/lib/jobPreflight.ts',
"else{const r=generateContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];const excluded=operation.excludedSegmentIds??[],topology=operation.topology==='open'?'offene DXF-Kontur':excluded.length?`aufgebrochen · ${excluded.length} Strecke${excluded.length===1?'':'n'} aus`:'geschlossen',side=operation.topology==='open'?(operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie'):(operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie');detail=`${topology} · ${side} · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;if(r.ok)canonicalToolpath=canonicalContourToolpathFromGcode(r.code,operation.tool.diameterMm);}",
"else{const state=buildDxfContourCanonicalState({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...state.errors];opWarnings=[...state.warnings];const excluded=operation.excludedSegmentIds??[],topology=operation.topology==='open'?'offene DXF-Kontur':excluded.length?`aufgebrochen · ${excluded.length} Strecke${excluded.length===1?'':'n'} aus`:'geschlossen',side=operation.topology==='open'?(operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie'):(operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie');detail=`${topology} · ${side} · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;if(state.ok)canonicalToolpath=state.toolpath;}",
'DXF preflight must consume canonical XYZ state directly');

const gate='scripts/check-004z-contracts.mjs';let g=fs.readFileSync(gate,'utf8');
const anchor="requireText(app,'STEP auch für offene Konturen','Bearbeiten explains open STEP tab support');";
if(!g.includes(anchor))throw new Error('004Z-F1 gate anchor');
const add=`${anchor}\nconst dxfGcode=read('src/lib/gcode.ts');\nrequireText(dxfGcode,'export function buildDxfContourCanonicalState','004Z-F1 gives DXF a direct canonical contour state');\nrequireText(dxfGcode,'const led=applyContourLeads(finished.toolpath,args.operation)','DXF resolves the logical lead before tabs');\nrequireText(dxfGcode,'const tabbed=applyStepContourTabs(led.toolpath,args.operation,0)','DXF reuses the same spatial tab kernel as STEP');\nrejectText(dxfGcode,'applyContourTabs','legacy split-run DXF tab kernel must not return');\nrequireText(active,'buildDxfContourCanonicalState','Bearbeiten consumes DXF canonical XYZ tabs directly');\nrequireText(preflight,'buildDxfContourCanonicalState','Prüfen consumes DXF canonical XYZ tabs directly');\nrejectText(preflight,'canonicalContourToolpathFromGcode(r.code,operation.tool.diameterMm)','Prüfen must not flatten DXF XYZ tabs by reparsing emitted G-code');`;
g=g.replace(anchor,add);
g=g.replace('and 004Z-F keeps STEP tabs inside one canonical XYZ contour passage.','004Z-F keeps STEP tabs inside one canonical XYZ contour passage, and 004Z-F1 unifies DXF on that same spatial tab contract.');
fs.writeFileSync(gate,g);
