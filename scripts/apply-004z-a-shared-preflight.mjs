import fs from 'node:fs';

function replaceOnce(path,from,to,label){
  let text=fs.readFileSync(path,'utf8');
  if(!text.includes(from))throw new Error(`${label}: anchor missing`);
  text=text.replace(from,to);
  fs.writeFileSync(path,text);
}

// App: compute one shared canonical job preflight and hand the exact same snapshot to Prüfen and Fräsen.
const app='src/App.svelte';
replaceOnce(app,
  "  import { resolveContourDepth } from './lib/contourDepth';",
  "  import { resolveContourDepth } from './lib/contourDepth';\n  import { validateJob, type JobPreflightResult } from './lib/jobPreflight';",
  'App imports shared job preflight');
replaceOnce(app,
  "  $: contourDepthState=operation.kind==='contour'?resolveContourDepth({operation,stock,stockMode,wcs}):null;",
  "  $: contourDepthState=operation.kind==='contour'?resolveContourDepth({operation,stock,stockMode,wcs}):null;\n  $: jobPreflight:JobPreflightResult|null=importSummary?validateJob({summary:importSummary,stock,stockMode,placement,orientation,wcs,operations:operationsProject.operations,fixtures,machineEnvelope:machineEnvelopeEnabled?machineEnvelope:null,machineWcsOrigin:machineEnvelopeEnabled?machineWcsOrigin:null,spindleHead:spindleHeadEnabled?spindleHead:null}):null;",
  'App shared job preflight state');
replaceOnce(app,
  "<JobPreflightPanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} machineEnvelope={machineEnvelopeEnabled?machineEnvelope:null} machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} spindleHead={spindleHeadEnabled?spindleHead:null} operations={operationsProject.operations}/>",
  "{#if jobPreflight}<JobPreflightPanel result={jobPreflight}/>{/if}",
  'Prüfen consumes shared snapshot');
replaceOnce(app,
  "<JobGCodePanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} machineEnvelope={machineEnvelopeEnabled?machineEnvelope:null} machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} spindleHead={spindleHeadEnabled?spindleHead:null} operations={operationsProject.operations}/>",
  "{#if jobPreflight}<JobGCodePanel summary={importSummary} {stock} {stockMode} {placement} {orientation} {wcs} {fixtures} machineEnvelope={machineEnvelopeEnabled?machineEnvelope:null} machineWcsOrigin={machineEnvelopeEnabled?machineWcsOrigin:null} spindleHead={spindleHeadEnabled?spindleHead:null} operations={operationsProject.operations} preflight={jobPreflight}/>{/if}",
  'Fräsen consumes shared snapshot');

// Prüfen panel becomes a pure renderer of the supplied snapshot.
const preflightPanel='src/lib/JobPreflightPanel.svelte';
let pp=fs.readFileSync(preflightPanel,'utf8');
const ppStart=`<script lang="ts">\n  import type { CamOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';\n  import { validateJob } from './jobPreflight';\n  import type { FixtureVolume } from './fixtureCollision';\n  import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';\n  import type { SpindleHeadGeometry } from './spindleHeadCollision';\n  export let summary:ImportSummary;export let stock:StockDefinition;export let stockMode:StockMode;export let placement:PartPlacement;export let orientation:PartOrientation;export let wcs:WorkCoordinateSystem;export let fixtures:FixtureVolume[]=[];export let machineEnvelope:MachineEnvelope|null=null;export let machineWcsOrigin:MachineWcsOrigin|null=null;export let spindleHead:SpindleHeadGeometry|null=null;export let operations:CamOperation[];\n  $: result=validateJob({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures,machineEnvelope,machineWcsOrigin,spindleHead});\n</script>`;
const ppNext=`<script lang="ts">\n  import type { JobPreflightResult } from './jobPreflight';\n  export let result:JobPreflightResult;\n</script>`;
if(!pp.includes(ppStart))throw new Error('JobPreflightPanel script anchor missing');
fs.writeFileSync(preflightPanel,pp.replace(ppStart,ppNext));

// Fräsen panel receives that exact same snapshot.
const gcodePanel='src/lib/JobGCodePanel.svelte';
replaceOnce(gcodePanel,
  "  import { generateJobGcode } from './jobGcode';",
  "  import { generateJobGcode } from './jobGcode';\n  import type { JobPreflightResult } from './jobPreflight';",
  'JobGCodePanel preflight type');
replaceOnce(gcodePanel,
  "  export let spindleHead:SpindleHeadGeometry|null=null;",
  "  export let spindleHead:SpindleHeadGeometry|null=null;\n  export let preflight:JobPreflightResult;",
  'JobGCodePanel preflight prop');
replaceOnce(gcodePanel,
  "  $: raw=generateJobGcode({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures,machineEnvelope,machineWcsOrigin,spindleHead});",
  "  $: raw=generateJobGcode({summary,stock,stockMode,placement,orientation,wcs,operations,fixtures,machineEnvelope,machineWcsOrigin,spindleHead,preflight});",
  'JobGCodePanel forwards shared preflight');

// NC generator: consume supplied preflight, map by sequence (not id lookup), and enforce run↔motion Z parity.
const job='src/lib/jobGcode.ts';
replaceOnce(job,
  "import { validateJob } from './jobPreflight';",
  "import { validateJob, type JobPreflightResult } from './jobPreflight';",
  'jobGcode preflight type');
replaceOnce(job,
  "type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[];machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null;spindleHead?:SpindleHeadGeometry|null};",
  "type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[];machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null;spindleHead?:SpindleHeadGeometry|null;preflight?:JobPreflightResult};",
  'jobGcode optional shared preflight');
replaceOnce(job,
  "export function generateJobGcode(args:Args):JobGcodeResult{\n  const enabled=args.operations.filter(op=>op.enabled!==false),preflight=validateJob(args);",
  "function contourMotionParity(operation:CamOperation,toolpath:import('./canonicalToolpath').CanonicalToolpath):string[]{\n  if(operation.kind!=='contour'||!toolpath.runs.length||!toolpath.motions?.length)return[];\n  const key=(z:number)=>Math.round(z*1000000)/1000000;\n  const required=[...new Set(toolpath.runs.map(run=>key(run.z)))];\n  const present=new Set(toolpath.motions.filter(motion=>motion.kind!=='rapid3'&&Math.abs(motion.start.z-motion.end.z)<1e-7).map(motion=>key(motion.end.z)));\n  const missing=required.filter(z=>!present.has(z));\n  return missing.length?[`004Z-A NC-Parität: ${missing.length} Kontur-Z-Ebene${missing.length===1?'':'n'} aus dem geprüften kanonischen Toolpath fehlen in den materialisierten Maschinenbewegungen: ${missing.map(z=>z.toFixed(3)).join(', ')} mm.`]:[];\n}\n\nexport function generateJobGcode(args:Args):JobGcodeResult{\n  const enabled=args.operations.filter(op=>op.enabled!==false),preflight=args.preflight??validateJob(args);",
  'jobGcode shared snapshot and parity helper');
replaceOnce(job,
  "  const prepared=enabled.map(operation=>({operation,preflight:preflight.operations.find(item=>item.id===operation.id)}));",
  "  const prepared=enabled.map((operation,index)=>({operation,preflight:preflight.operations[index]}));",
  'jobGcode sequence mapping');
replaceOnce(job,
  "  const missing=prepared.filter(item=>!item.preflight?.toolpath);\n  if(missing.length)return{ok:false,errors:missing.map(item=>`Bearbeitung ${item.operation.name}: 004T liefert keinen materialisierten Werkzeugweg.`),warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};",
  "  const missing=prepared.filter(item=>!item.preflight?.toolpath);\n  if(missing.length)return{ok:false,errors:missing.map(item=>`Bearbeitung ${item.operation.name}: 004T liefert keinen materialisierten Werkzeugweg.`),warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};\n  const parityErrors=prepared.flatMap(item=>contourMotionParity(item.operation,item.preflight!.toolpath!).map(message=>`${item.operation.name}: ${message}`));\n  if(parityErrors.length)return{ok:false,errors:parityErrors,warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};",
  'jobGcode parity gate');

// Gate the architecture.
const gate='scripts/check-004z-contracts.mjs';
let gt=fs.readFileSync(gate,'utf8');
const anchor="requireText(preflight,'previousToolpaths:stockSimulationOperations.map(entry=>entry.toolpath)','Prüfen resolves STEP contour start from the exact prior canonical job history');";
const extra=`${anchor}\nrequireText(app,'$: jobPreflight:JobPreflightResult|null=importSummary?validateJob','App owns one canonical job preflight snapshot for Prüfen and Fräsen');\nrequireText(app,'<JobPreflightPanel result={jobPreflight}/>','Prüfen renders the shared canonical snapshot');\nrequireText(app,'preflight={jobPreflight}','Fräsen receives the exact same canonical snapshot');\nconst jobGcode=read('src/lib/jobGcode.ts');\nrequireText(jobGcode,'preflight=args.preflight??validateJob(args)','NC generation consumes the shared snapshot when supplied');\nrequireText(jobGcode,'preflight:preflight.operations[index]','NC maps operations to preflight by canonical sequence');\nrequireText(jobGcode,'function contourMotionParity','NC has an explicit contour run-to-motion parity gate');\nrequireText(jobGcode,'004Z-A NC-Parität','NC refuses silent loss of STEP contour Z levels');`;
if(!gt.includes(anchor))throw new Error('004Z gate shared-preflight anchor missing');
gt=gt.replace(anchor,extra);
fs.writeFileSync(gate,gt);

console.log('004Z-A shared Prüfen/Fräsen snapshot and NC parity gate applied.');
