import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`);};
const rejectText=(text,needle,label)=>{if(text.includes(needle))throw new Error(`${label}: forbidden ${needle}`);};

const targets=read('src/lib/stepContourTargets.ts');
const state=read('src/lib/stepContourOperation.ts');
const openMath=read('src/lib/openContourMath.ts');
const types=read('src/lib/types.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');

requireText(types,"export type ContourTopology='closed'|'open'",'contour grammar keeps open/closed topology shared across DXF and STEP');
requireText(types,"export type OpenContourSide='left'|'right'|'on-line'",'open contour side grammar stays shared');
requireText(types,'excludedSegmentIds?:number[]','contour operation persists segment exclusions');
requireText(targets,'export function buildStepContourTargets','STEP contour manufacturing targets are explicit');
requireText(targets,'targetKey:`step-wire:${wire.wireId}`','STEP contour target identity is stable');
requireText(targets,"topology:wire.closed?'closed':'open'",'native open STEP wires are retained');
requireText(targets,'edgeIds:segments.map(segment=>segment.edgeId)','STEP target carries native BRep edge identity');
requireText(targets,'export function stepContourTargetAfterExclusions','STEP contour targets support edge exclusion');
requireText(targets,"topology:'open'",'excluding STEP edges materializes an open machining target');
requireText(targets,'chains.length!==1','edge exclusions must leave exactly one connected machining chain');
requireText(openMath,'export function offsetOpenPolyline','shared open contour kernel owns polyline offset');
requireText(openMath,'export function openContourCorrection','shared open contour kernel owns left/right/on-line correction');
requireText(state,"operation.topology==='open'",'STEP contour state has productive open-topology behavior');
requireText(state,'openContourCorrection(operation.openSide,operation.tool.diameterMm)','STEP open contour consumes shared side correction');
requireText(state,'offsetOpenPolyline(source,correction)','STEP open contour consumes shared open offset kernel');
requireText(state,'stepContourTargetAfterExclusions','STEP contour state consumes excluded native BRep edges');
requireText(state,'sourceOperationId:operation.id','STEP canonical contour preserves operation identity');
requireText(state,'targetKey:effective.targetKey','STEP canonical contour preserves effective manufacturing target identity');
rejectText(state,'004F gibt STEP zunächst nur für geschlossene Konturen frei.','legacy closed-only STEP restriction must not return');
requireText(active,'buildStepContourOperationState','Bearbeiten continues to consume the canonical STEP contour state');
requireText(preflight,'buildStepContourOperationState','Prüfen continues to consume the same STEP contour state');

console.log('004Z PASS: STEP contours share the DXF open/closed grammar, retain native edge identity, use shared open-contour math, allow one connected Headstock-style open chain, and stay canonical through Bearbeiten/Prüfen/NC.');
