import fs from 'node:fs';

const patch=(path,replacements)=>{
  let text=fs.readFileSync(path,'utf8');
  for(const [from,to,label] of replacements){
    if(!text.includes(from))throw new Error(`${path}: patch anchor missing: ${label}`);
    text=text.replace(from,to);
  }
  fs.writeFileSync(path,text);
};

patch('src/lib/types.ts',[
  [
    "stepWireId?:number|null;depthMode?:ContourDepthMode;",
    "stepWireId?:number|null;stepContourFaceIds?:number[];depthMode?:ContourDepthMode;",
    'persist selected STEP contour side faces'
  ],
  [
    "contourId:null,stepWireId:null,depthMode:'manual'",
    "contourId:null,stepWireId:null,stepContourFaceIds:[],depthMode:'manual'",
    'default contour side faces'
  ]
]);

patch('src/lib/GeometryView.svelte',[
  [
    "function stepFaceSelectable(faceId:number){if(!stepSelectionOperation)return false;if(stepSelectionOperation.kind==='pocket')return !!stepPocketSelection?.candidates.some(c=>c.faceId===faceId);if(stepSelectionOperation.kind==='drill')return stepHoleCandidates.some(h=>h.faceIds.includes(faceId));return false;}",
    "function stepFaceSelectable(faceId:number){if(!stepSelectionOperation)return false;if(stepSelectionOperation.kind==='contour')return !!stepContourSelection?.eligibleSideFaceIds.includes(faceId);if(stepSelectionOperation.kind==='pocket')return !!stepPocketSelection?.candidates.some(c=>c.faceId===faceId);if(stepSelectionOperation.kind==='drill')return stepHoleCandidates.some(h=>h.faceIds.includes(faceId));return false;}",
    'contour side faces are selectable'
  ],
  [
    "function stepFaceSelected(faceId:number){if(!stepSelectionOperation)return false;if(stepSelectionOperation.kind==='pocket')return stepSelectionOperation.stepFaceId===faceId;if(stepSelectionOperation.kind==='drill')return stepHoleCandidates.some(h=>h.faceIds.includes(faceId)&&(stepSelectionOperation.stepHoleFeatureIds??[]).includes(h.featureId));return false;}",
    "function stepFaceSelected(faceId:number){if(!stepSelectionOperation)return false;if(stepSelectionOperation.kind==='contour')return (stepSelectionOperation.stepContourFaceIds??[]).includes(faceId);if(stepSelectionOperation.kind==='pocket')return stepSelectionOperation.stepFaceId===faceId;if(stepSelectionOperation.kind==='drill')return stepHoleCandidates.some(h=>h.faceIds.includes(faceId)&&(stepSelectionOperation.stepHoleFeatureIds??[]).includes(h.featureId));return false;}",
    'selected contour side faces are highlighted'
  ],
  [
    "if(stepSelectionOperation&&stepFaceSelectable(faceId)){if(stepSelectionOperation.kind==='pocket')",
    "if(stepSelectionOperation&&stepFaceSelectable(faceId)){if(stepSelectionOperation.kind==='contour'){const set=new Set(stepSelectionOperation.stepContourFaceIds??[]);set.has(faceId)?set.delete(faceId):set.add(faceId);onStepContourChange({topology:'open',stepContourFaceIds:[...set].sort((a,b)=>a-b),stepWireId:null,excludedSegmentIds:[]});return;}if(stepSelectionOperation.kind==='pocket')",
    'face click builds open STEP contour'
  ],
  [
    "function stepEdgeSelectable(edgeId:number){if(stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return false;const selected=selectedStepContourTarget();if(selected&&selected.edgeIds.includes(edgeId))return true;const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));return matches.length===1;}",
    "function stepEdgeSelectable(edgeId:number){if(stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return false;if(stepSelectionOperation.topology==='open')return stepContourSelection.selectedEdgeIds.includes(edgeId);const selected=selectedStepContourTarget();if(selected)return selected.edgeIds.includes(edgeId);const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));return matches.length===1;}",
    'open mode exposes only active target edges'
  ],
  [
    "function toggleStepEdge(edgeId:number){if(dragMoved||stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return;const selected=selectedStepContourTarget();if(!selected||!selected.edgeIds.includes(edgeId)){const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));if(matches.length!==1)return;const target=matches[0];onStepContourChange({stepWireId:target.wireId,topology:target.topology,excludedSegmentIds:[]});return;}if(stepSelectionOperation.topology==='open'){const excluded=new Set(stepSelectionOperation.excludedSegmentIds??[]);excluded.has(edgeId)?excluded.delete(edgeId):excluded.add(edgeId);onStepContourChange({excludedSegmentIds:[...excluded].sort((a,b)=>a-b)});return;}onStepContourChange({stepWireId:null,excludedSegmentIds:[]});}",
    "function toggleStepEdge(edgeId:number){if(dragMoved||stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return;if(stepSelectionOperation.topology==='open'){if(!stepContourSelection.selectedEdgeIds.includes(edgeId))return;const excluded=new Set(stepSelectionOperation.excludedSegmentIds??[]);excluded.has(edgeId)?excluded.delete(edgeId):excluded.add(edgeId);onStepContourChange({excludedSegmentIds:[...excluded].sort((a,b)=>a-b)});return;}const selected=selectedStepContourTarget();if(!selected||!selected.edgeIds.includes(edgeId)){const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));if(matches.length!==1)return;const target=matches[0];onStepContourChange({stepWireId:target.wireId,stepContourFaceIds:[],topology:'closed',excludedSegmentIds:[]});return;}onStepContourChange({stepWireId:null,excludedSegmentIds:[]});}",
    'edge click is refinement for open face targets'
  ],
  [
    "{#each s3.edges as edge}<path d={edge.d} class=\"step-edge\" class:selectable-step-edge={stepEdgeSelectable(edge.edgeId)} class:selected-step-edge={selectedStepContourTarget()?.edgeIds.includes(edge.edgeId)&&!stepEdgeExcluded(edge.edgeId)} class:excluded-step-edge={stepEdgeExcluded(edge.edgeId)} role={stepEdgeSelectable(edge.edgeId)?'button':undefined} tabindex=\"-1\" onclick={()=>toggleStepEdge(edge.edgeId)}><title>{stepEdgeExcluded(edge.edgeId)?`Kante ${edge.edgeId+1} · ausgeschlossen`:`Kante ${edge.edgeId+1}`}</title></path>{/each}",
    "{#each s3.edges as edge}{#if stepEdgeSelectable(edge.edgeId)}<path d={edge.d} class=\"step-edge-hit\" role=\"button\" tabindex=\"-1\" onclick={()=>toggleStepEdge(edge.edgeId)}><title>{stepEdgeExcluded(edge.edgeId)?`Kante ${edge.edgeId+1} wieder einschalten`:`Kante ${edge.edgeId+1} bearbeiten`}</title></path>{/if}<path d={edge.d} class=\"step-edge\" class:selectable-step-edge={stepEdgeSelectable(edge.edgeId)} class:selected-step-edge={stepContourSelection?.selectedEdgeIds.includes(edge.edgeId)&&!stepEdgeExcluded(edge.edgeId)} class:excluded-step-edge={stepEdgeExcluded(edge.edgeId)}/>{/each}",
    'separate visual edge and generous hit stroke'
  ],
  [
    ".step-edge{fill:none;stroke:rgba(42,55,49,.56);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.step-edge.selectable-step-edge{pointer-events:stroke;cursor:pointer;stroke-width:2}.step-edge.selected-step-edge{stroke:#c27528;stroke-width:2.5}.step-edge.excluded-step-edge{stroke:#9a5c1e;stroke-width:2.2;stroke-dasharray:5 4;opacity:.55}",
    ".step-edge-hit{fill:none;stroke:rgba(0,0,0,0);stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}.step-edge{fill:none;stroke:rgba(42,55,49,.56);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.step-edge.selectable-step-edge{stroke-width:1.8}.step-edge.selected-step-edge{stroke:#c27528;stroke-width:2.5}.step-edge.excluded-step-edge{stroke:#9a5c1e;stroke-width:2.2;stroke-dasharray:5 4;opacity:.55}",
    'generous invisible edge hitbox'
  ]
]);

patch('src/App.svelte',[
  [
    "operation.kind==='contour'?'Klicke eine eindeutig zuordenbare Kante der gewünschten STEP-Kontur. Geschlossene Wires können anschließend für offene Bearbeitung gezielt aufgebrochen werden.':'Klicke die planare STEP-Face, die als Taschenboden bearbeitet werden soll.'",
    "operation.kind==='contour'?'Offene Kontur: Klicke die Seitenfläche(n), deren obere Profilkante gefräst werden soll. Geschlossene Kontur: Wähle weiterhin eine eindeutige Randkante.':'Klicke die planare STEP-Face, die als Taschenboden bearbeitet werden soll.'",
    'face-first STEP contour help'
  ],
  [
    "<p class=\"note\"><strong>STEP-Ziel:</strong> {operation.stepWireId==null?'Noch keine Wire explizit gewählt.':`Wire ${operation.stepWireId} gewählt.`}</p>",
    "<p class=\"note\"><strong>STEP-Ziel:</strong> {operation.topology==='open'?(operation.stepContourFaceIds?.length?`${operation.stepContourFaceIds.length} Seitenfläche${operation.stepContourFaceIds.length===1?'':'n'} gewählt.`:'Noch keine Seitenfläche gewählt.'):(operation.stepWireId==null?'Noch keine geschlossene Kontur gewählt.':`Wire ${operation.stepWireId} gewählt.`)}</p>",
    'STEP contour target summary'
  ],
  [
    "{#if importSummary.kind==='step'&&operation.topology==='open'}<p class=\"note\">Klicke im STEP-Viewport auf Kanten der gewählten Wire, um sie aus der Bearbeitung auszuschließen. Übrig bleiben muss genau eine zusammenhängende offene Kontur.</p>{/if}",
    "{#if importSummary.kind==='step'&&operation.topology==='open'}<p class=\"note\">Klicke Seitenflächen direkt im STEP-Modell an. Angrenzende Flächen erweitern die offene Profilkante; ein erneuter Klick entfernt sie. Die hervorgehobenen Profilkanten können anschließend mit großzügiger Trefferfläche fein angepasst werden.</p>{/if}",
    'face-first topology note'
  ]
]);

patch('scripts/check-004z-contracts.mjs',[
  [
    "const preflight=read('src/lib/jobPreflight.ts');",
    "const preflight=read('src/lib/jobPreflight.ts');\nconst sideFaces=read('src/lib/stepSideFaceContour.ts');\nconst geometryView=read('src/lib/GeometryView.svelte');\nconst app=read('src/App.svelte');",
    '004Z gate reads face-first files'
  ],
  [
    "requireText(types,'excludedSegmentIds?:number[]','contour operation persists segment exclusions');",
    "requireText(types,'excludedSegmentIds?:number[]','contour operation persists segment exclusions');\nrequireText(types,'stepContourFaceIds?:number[]','contour operation persists STEP side-face selection');\nrequireText(sideFaces,'export function buildStepSideFaceContour','STEP side faces resolve to an open contour target');\nrequireText(sideFaces,'isStepContourSideFace','STEP contour face eligibility is explicit');\nrequireText(sideFaces,'stepSideFaceContourAfterExclusions','side-face contour keeps edge-second refinement');",
    '004Z face-first data contract'
  ],
  [
    "requireText(preflight,'buildStepContourOperationState','Prüfen continues to consume the same STEP contour state');",
    "requireText(preflight,'buildStepContourOperationState','Prüfen continues to consume the same STEP contour state');\nrequireText(state,'buildStepSideFaceContour(summary,operation.stepContourFaceIds??[])','STEP contour state consumes side-face targets');\nrequireText(geometryView,\"stepSelectionOperation.kind==='contour')return !!stepContourSelection?.eligibleSideFaceIds.includes(faceId)\",'STEP side faces are primary selectable hit areas');\nrequireText(geometryView,'stroke-width:14','edge refinement uses a generous invisible hit stroke');\nrequireText(geometryView,\"onStepContourChange({topology:'open',stepContourFaceIds:\",'clicking a side face directly builds an open contour selection');\nrequireText(app,'Offene Kontur: Klicke die Seitenfläche(n)','Bearbeiten explains face-first STEP contour selection');",
    '004Z face-first UI contract'
  ],
  [
    "console.log('004Z PASS: STEP contours share the DXF open/closed grammar, retain native edge identity, use shared open-contour math, allow one connected Headstock-style open chain, and stay canonical through Bearbeiten/Prüfen/NC.');",
    "console.log('004Z PASS: STEP contours use face-first open selection with edge-second refinement, retain the DXF open/closed grammar and canonical Bearbeiten/Prüfen/NC path.');",
    '004Z gate result'
  ]
]);

console.log('004Z face-first patch applied.');
