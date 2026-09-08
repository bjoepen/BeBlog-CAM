import fs from 'node:fs';

function replaceOnce(path, from, to, label){
  let text=fs.readFileSync(path,'utf8');
  if(!text.includes(from))throw new Error(`${label}: anchor missing`);
  text=text.replace(from,to);
  fs.writeFileSync(path,text);
}

const app='src/App.svelte';
const helperAnchor=`  $: activeCanonicalToolpath = buildOrderedActiveCanonicalToolpath(importSummary,stock,stockMode,placement,orientation,wcs,operation,operationsProject);`;
const helper=`  function buildOrderedJobCanonicalToolpaths(summary:ImportSummary|null,currentStock:StockDefinition,currentStockMode:StockMode,currentPlacement:PartPlacement,currentOrientation:PartOrientation,currentWcs:WorkCoordinateSystem,project:OperationsProject){\n    if(!summary)return[];\n    const toolpaths:CanonicalToolpath[]=[];\n    for(const candidate of project.operations){\n      if(candidate.enabled===false)continue;\n      const toolpath=buildActiveCanonicalToolpath({summary,stock:currentStock,stockMode:currentStockMode,placement:currentPlacement,orientation:currentOrientation,wcs:currentWcs,operation:candidate,previousToolpaths:toolpaths});\n      if(toolpath)toolpaths.push(toolpath);\n    }\n    return toolpaths;\n  }\n  $: activeCanonicalToolpath = buildOrderedActiveCanonicalToolpath(importSummary,stock,stockMode,placement,orientation,wcs,operation,operationsProject);`;
replaceOnce(app,helperAnchor,helper,'ordered job helper');

const previewFrom=`  $: preflightStepToolpaths=importSummary?.kind==='step'?operationsProject.operations.filter(op=>op.enabled!==false&&op.kind!=='z-level-roughing').map(op=>buildActiveCanonicalToolpath({summary:importSummary!,stock,stockMode,placement,orientation,wcs,operation:op})).filter((toolpath):toolpath is CanonicalToolpath=>toolpath!==null):[];`;
const previewTo=`  $: preflightStepToolpaths=importSummary?.kind==='step'?buildOrderedJobCanonicalToolpaths(importSummary,stock,stockMode,placement,orientation,wcs,operationsProject).filter(toolpath=>toolpath.operationKind!=='z-level-roughing'):[];`;
replaceOnce(app,previewFrom,previewTo,'STEP preflight canonical history');

const core='src/lib/FeedsSpeedsCalculatorCore.svelte';
const fieldsAnchor=`        {/if}\n      </div>\n\n      <section class="recognized">`;
const fields=`        {/if}\n        <section class="field-card"><div class="field-block"><b>Auskragung</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" value={tool.stickoutMm} oninput={e=>setNumber('stickoutMm',e)}/><em>mm</em></span><small>Werkzeugspitze bis Unterkante Spannzange/Halter; wird von der 004Q-Reichweitenprüfung verwendet.</small></div></section>\n        <section class="field-card"><div class="field-block"><b>Halter-Ø</b><span class="input-line"><input class="numeric-input" type="number" min="0.1" step="0.1" value={tool.holderDiameterMm} oninput={e=>setNumber('holderDiameterMm',e)}/><em>mm</em></span><small>Konservativer Außendurchmesser von Spannzange bzw. Halter für die Kollisionsprüfung.</small></div></section>\n      </div>\n\n      <section class="recognized">`;
replaceOnce(core,fieldsAnchor,fields,'tool assembly editor fields');

const gate='scripts/check-004z-contracts.mjs';
let gateText=fs.readFileSync(gate,'utf8');
const gateAnchor=`requireText(preflight,'previousToolpaths:stockSimulationOperations.map(entry=>entry.toolpath)','Prüfen resolves STEP contour start from the exact prior canonical job history');`;
const gateInsert=`${gateAnchor}\nrequireText(app,'function buildOrderedJobCanonicalToolpaths','STEP Prüfen preview owns an ordered canonical job-history builder');\nrequireText(app,"previousToolpaths:toolpaths",'STEP Prüfen preview forwards exact earlier canonical paths into each later operation');\nrequireText(app,"buildOrderedJobCanonicalToolpaths(importSummary,stock,stockMode,placement,orientation,wcs,operationsProject).filter",'STEP Prüfen visualization consumes the ordered job path instead of isolated reconstruction');\nconst tools=read('src/lib/FeedsSpeedsCalculatorCore.svelte');\nrequireText(tools,'<b>Auskragung</b>','tool editor exposes 004Q stickout explicitly');\nrequireText(tools,"setNumber('stickoutMm',e)",'tool editor persists explicit stickout input');\nrequireText(tools,'<b>Halter-Ø</b>','tool editor exposes holder diameter explicitly');\nrequireText(tools,"setNumber('holderDiameterMm',e)",'tool editor persists explicit holder diameter input');`;
if(!gateText.includes(gateAnchor))throw new Error('004Z gate anchor missing');
gateText=gateText.replace(gateAnchor,gateInsert);
fs.writeFileSync(gate,gateText);

console.log('004Z canonical Prüfen preview + explicit 004Q tool assembly fields applied.');
