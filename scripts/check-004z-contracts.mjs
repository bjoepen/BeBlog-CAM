import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const requireText=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`${label}: missing ${needle}`);};
const rejectText=(text,needle,label)=>{if(text.includes(needle))throw new Error(`${label}: forbidden ${needle}`);};

const targets=read('src/lib/stepContourTargets.ts');
const sideFaces=read('src/lib/stepSideFaceContour.ts');
const state=read('src/lib/stepContourOperation.ts');
const openMath=read('src/lib/openContourMath.ts');
const types=read('src/lib/types.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const app=read('src/App.svelte');
const geometryView=read('src/lib/GeometryView.svelte');

requireText(types,"export type ContourTopology='closed'|'open'",'contour grammar keeps open/closed topology shared across DXF and STEP');
requireText(types,"export type OpenContourSide='left'|'right'|'on-line'",'open contour side grammar stays shared');
requireText(types,'excludedSegmentIds?:number[]','contour operation persists segment exclusions');
requireText(types,'stepContourFaceIds?:number[]','contour operation persists STEP side-face selection');
requireText(targets,'export function buildStepContourTargets','STEP closed contour manufacturing targets are explicit');
requireText(targets,'targetKey:`step-wire:${wire.wireId}`','STEP closed contour target identity is stable');
requireText(targets,'export function stepContourTargetAfterExclusions','legacy/open-wire fallback retains native edge exclusion');
requireText(sideFaces,'export function buildStepSideFaceContour','STEP side faces resolve to an open contour target');
requireText(sideFaces,'isStepContourSideFace','STEP contour face eligibility is explicit');
requireText(sideFaces,'stepSideFaceContourAfterExclusions','side-face contour keeps edge-second refinement');
requireText(openMath,'export function offsetOpenPolyline','shared open contour kernel owns polyline offset');
requireText(openMath,'export function openContourCorrection','shared open contour kernel owns left/right/on-line correction');
requireText(state,"operation.topology==='closed'",'STEP contour state retains closed topology path');
requireText(state,"buildStepSideFaceContour(summary,operation.stepContourFaceIds??[])",'STEP open contour consumes side-face targets');
requireText(state,'stepSideFaceContourAfterExclusions(sideResult.target,excluded)','STEP side-face target supports edge refinement');
requireText(state,'openContourCorrection(operation.openSide,operation.tool.diameterMm)','STEP open contour consumes shared side correction');
requireText(state,'offsetOpenPolyline(source,correction)','STEP open contour consumes shared open offset kernel');
requireText(state,'sourceOperationId:operation.id','STEP canonical contour preserves operation identity');
requireText(state,'targetKey:effective.targetKey','STEP canonical contour preserves effective manufacturing target identity');
rejectText(state,'004F gibt STEP zunächst nur für geschlossene Konturen frei.','legacy closed-only STEP restriction must not return');
requireText(active,'buildStepContourOperationState','Bearbeiten continues to consume the canonical STEP contour state');
requireText(preflight,'buildStepContourOperationState','Prüfen continues to consume the same STEP contour state');
requireText(app,'onStepContourChange={(patch)=>operation.kind===\'contour\'&&updateContour(patch)}','App forwards complete STEP contour edits');
requireText(app,'Offene Kontur: Klicke die Seitenfläche(n)','Bearbeiten explains face-first STEP contour selection');
requireText(app,'stepContourFaceIds.length','Bearbeiten reports selected STEP side faces');
requireText(geometryView,"stepSelectionOperation.kind==='contour')return !!stepContourSelection?.eligibleSideFaceIds.includes(faceId)",'STEP side faces are primary selectable hit areas');
requireText(geometryView,"onStepContourChange({topology:'open',stepContourFaceIds:",'clicking a side face directly builds an open contour selection');
requireText(geometryView,"if(stepSelectionOperation.topology==='open')return stepContourSelection.selectedEdgeIds.includes(edgeId)",'open mode exposes only the active target edges');
requireText(geometryView,'class="step-edge-hit"','edge refinement has a dedicated invisible hit path');
requireText(geometryView,'stroke-width:14','edge refinement uses a generous hit stroke');
requireText(geometryView,'class:excluded-step-edge={stepEdgeExcluded(edge.edgeId)}','excluded STEP edges remain visually explicit');

console.log('004Z PASS: STEP contours use face-first open selection with edge-second refinement, retain the shared open/closed grammar, and stay canonical through Bearbeiten/Prüfen/NC.');
