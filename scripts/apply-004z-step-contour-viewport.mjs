import fs from 'node:fs';

const patch=(path,replacements)=>{
  let text=fs.readFileSync(path,'utf8');
  for(const [from,to,label] of replacements){
    if(!text.includes(from))throw new Error(`${path}: patch anchor missing: ${label}`);
    text=text.replace(from,to);
  }
  fs.writeFileSync(path,text);
};

patch('src/App.svelte',[
  [
    "onStepWireIdChange={(wireId)=>operation.kind==='contour'&&updateContour({stepWireId:wireId})}",
    "onStepContourChange={(patch)=>operation.kind==='contour'&&updateContour(patch)}",
    'GeometryView contour callback'
  ],
  [
    "operation.kind==='contour'?'Klicke eine eindeutig zuordenbare Kante der gewünschten geschlossenen STEP-Wire.':'Klicke die planare STEP-Face, die als Taschenboden bearbeitet werden soll.'",
    "operation.kind==='contour'?'Klicke eine eindeutig zuordenbare Kante der gewünschten STEP-Kontur. Geschlossene Wires können anschließend für offene Bearbeitung gezielt aufgebrochen werden.':'Klicke die planare STEP-Face, die als Taschenboden bearbeitet werden soll.'",
    'STEP contour selection help'
  ],
  [
    "{:else if operation.kind==='contour'}<div class=\"placement-section\"><p class=\"placement-title\">Bahn</p><div class=\"placement-grid\"><button class:active={operation.side==='outside'} onclick={()=>updateContour({side:'outside'})}>Außen</button><button class:active={operation.side==='inside'} onclick={()=>updateContour({side:'inside'})}>Innen</button><button class:active={operation.side==='on-line'} onclick={()=>updateContour({side:'on-line'})}>Auf Linie</button></div><div class=\"placement-grid two\"><button class:active={operation.direction==='climb'} onclick={()=>updateContour({direction:'climb'})}>Gleichlauf</button><button class:active={operation.direction==='conventional'} onclick={()=>updateContour({direction:'conventional'})}>Gegenlauf</button></div></div>",
    "{:else if operation.kind==='contour'}<div class=\"placement-section\"><p class=\"placement-title\">Konturtyp</p><div class=\"placement-grid two\"><button class:active={operation.topology==='closed'} onclick={()=>updateContour({topology:'closed',excludedSegmentIds:[]})}>Geschlossen</button><button class:active={operation.topology==='open'} onclick={()=>updateContour({topology:'open'})}>Offen</button></div>{#if importSummary.kind==='step'&&operation.topology==='open'}<p class=\"note\">Klicke im STEP-Viewport auf Kanten der gewählten Wire, um sie aus der Bearbeitung auszuschließen. Übrig bleiben muss genau eine zusammenhängende offene Kontur.</p>{/if}</div><div class=\"placement-section\"><p class=\"placement-title\">Bahn</p>{#if operation.topology==='open'}<div class=\"placement-grid\"><button class:active={operation.openSide==='left'} onclick={()=>updateContour({openSide:'left'})}>Links</button><button class:active={operation.openSide==='right'} onclick={()=>updateContour({openSide:'right'})}>Rechts</button><button class:active={operation.openSide==='on-line'} onclick={()=>updateContour({openSide:'on-line'})}>Auf Linie</button></div>{:else}<div class=\"placement-grid\"><button class:active={operation.side==='outside'} onclick={()=>updateContour({side:'outside'})}>Außen</button><button class:active={operation.side==='inside'} onclick={()=>updateContour({side:'inside'})}>Innen</button><button class:active={operation.side==='on-line'} onclick={()=>updateContour({side:'on-line'})}>Auf Linie</button></div>{/if}<div class=\"placement-grid two\"><button class:active={operation.direction==='climb'} onclick={()=>updateContour({direction:'climb'})}>Gleichlauf</button><button class:active={operation.direction==='conventional'} onclick={()=>updateContour({direction:'conventional'})}>Gegenlauf</button></div></div>",
    'contour topology and side controls'
  ]
]);

patch('src/lib/GeometryView.svelte',[
  [
    "export let onStepWireIdChange:(wireId:number|null)=>void=()=>{};",
    "export let onStepContourChange:(patch:Partial<ContourOperation>)=>void=()=>{};",
    'STEP contour callback prop'
  ],
  [
    "  function stepEdgeSelectable(edgeId:number){if(stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return false;const source=stepFeatureSourceResult?.ok?stepFeatureSourceResult.source:null;if(!source)return false;const candidateIds=new Set(stepContourSelection.candidates.map(c=>c.wireId));let matches=0;for(const wires of source.wiresByFace.values())for(const wire of wires)if(candidateIds.has(wire.wireId)&&wire.edgeIds.includes(edgeId))matches++;return matches===1;}\n  function toggleStepEdge(edgeId:number){if(dragMoved||stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return;const source=stepFeatureSourceResult?.ok?stepFeatureSourceResult.source:null;if(!source)return;const candidateIds=new Set(stepContourSelection.candidates.map(c=>c.wireId));const ids:number[]=[];for(const wires of source.wiresByFace.values())for(const wire of wires)if(candidateIds.has(wire.wireId)&&wire.edgeIds.includes(edgeId)&&!ids.includes(wire.wireId))ids.push(wire.wireId);if(ids.length===1)onStepWireIdChange(stepSelectionOperation.stepWireId===ids[0]?null:ids[0]);}",
    "  function selectedStepContourTarget(){if(stepSelectionOperation?.kind!=='contour'||!stepContourSelection||stepSelectionOperation.stepWireId==null)return null;return stepContourSelection.candidates.find(candidate=>candidate.wireId===stepSelectionOperation!.stepWireId)??null;}\n  function stepEdgeExcluded(edgeId:number){return stepSelectionOperation?.kind==='contour'&&stepSelectionOperation.topology==='open'&&(stepSelectionOperation.excludedSegmentIds??[]).includes(edgeId);}\n  function stepEdgeSelectable(edgeId:number){if(stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return false;const selected=selectedStepContourTarget();if(selected&&selected.edgeIds.includes(edgeId))return true;const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));return matches.length===1;}\n  function toggleStepEdge(edgeId:number){if(dragMoved||stepSelectionOperation?.kind!=='contour'||!stepContourSelection)return;const selected=selectedStepContourTarget();if(!selected||!selected.edgeIds.includes(edgeId)){const matches=stepContourSelection.candidates.filter(candidate=>candidate.edgeIds.includes(edgeId));if(matches.length!==1)return;const target=matches[0];onStepContourChange({stepWireId:target.wireId,topology:target.topology,excludedSegmentIds:[]});return;}if(stepSelectionOperation.topology==='open'){const excluded=new Set(stepSelectionOperation.excludedSegmentIds??[]);excluded.has(edgeId)?excluded.delete(edgeId):excluded.add(edgeId);onStepContourChange({excludedSegmentIds:[...excluded].sort((a,b)=>a-b)});return;}onStepContourChange({stepWireId:null,excludedSegmentIds:[]});}",
    'STEP edge selection and exclusion behavior'
  ],
  [
    "{#each s3.edges as edge}<path d={edge.d} class=\"step-edge\" class:selectable-step-edge={stepEdgeSelectable(edge.edgeId)} class:selected-step-edge={stepSelectionOperation?.kind==='contour'&&stepSelectionOperation.stepWireId!=null&&stepFeatureSourceResult?.ok&&[...stepFeatureSourceResult.source.wiresByFace.values()].flat().some(w=>w.wireId===stepSelectionOperation!.stepWireId&&w.edgeIds.includes(edge.edgeId))} role={stepEdgeSelectable(edge.edgeId)?'button':undefined} tabindex=\"-1\" onclick={()=>toggleStepEdge(edge.edgeId)}><title>Kante {edge.edgeId+1}</title></path>{/each}",
    "{#each s3.edges as edge}<path d={edge.d} class=\"step-edge\" class:selectable-step-edge={stepEdgeSelectable(edge.edgeId)} class:selected-step-edge={selectedStepContourTarget()?.edgeIds.includes(edge.edgeId)&&!stepEdgeExcluded(edge.edgeId)} class:excluded-step-edge={stepEdgeExcluded(edge.edgeId)} role={stepEdgeSelectable(edge.edgeId)?'button':undefined} tabindex=\"-1\" onclick={()=>toggleStepEdge(edge.edgeId)}><title>{stepEdgeExcluded(edge.edgeId)?`Kante ${edge.edgeId+1} · ausgeschlossen`:`Kante ${edge.edgeId+1}`}</title></path>{/each}",
    'STEP edge rendering state'
  ],
  [
    ".step-edge{fill:none;stroke:rgba(42,55,49,.56);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}",
    ".step-edge{fill:none;stroke:rgba(42,55,49,.56);stroke-width:1.15;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.step-edge.selectable-step-edge{pointer-events:stroke;cursor:pointer;stroke-width:2}.step-edge.selected-step-edge{stroke:#c27528;stroke-width:2.5}.step-edge.excluded-step-edge{stroke:#9a5c1e;stroke-width:2.2;stroke-dasharray:5 4;opacity:.55}",
    'STEP edge interaction styles'
  ]
]);

console.log('004Z viewport patch applied.');
