import fs from 'node:fs';

const app=fs.readFileSync('src/App.svelte','utf8');
const core=fs.readFileSync('src/lib/FeedsSpeedsCalculatorCore.svelte','utf8');
const checks=[
 ['tools render without importSummary gate', app.includes("{:else if activeStep==='Werkzeuge'}<div class=\"tool-shell\"><FeedsSpeedsCalculator")],
 ['standalone operation id is null', app.includes("operationId={importSummary?toolTargetOperation?.id??null:null}")],
 ['standalone choices are empty', app.includes("operationChoices={importSummary?operationsProject.operations.map")&&app.includes(":[]}" )],
 ['standalone transfer is disabled', app.includes("onTransfer={importSummary?applyToolOperationTransfer:undefined}")],
 ['operation target hidden without target', core.includes("{#if targetOperationId&&operationChoices.length>0}")],
 ['apply card hidden without operation', core.includes("{#if targetOperationId&&onApplyToOperation}<section class=\"apply-card\">")],
 ['library storage remains independent', core.includes("const STORAGE_KEY='beblog-cam.tool-library.v1'")]
];
let failed=false;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} 009-E: ${name}`);if(!ok)failed=true;}
if(failed)process.exit(1);
