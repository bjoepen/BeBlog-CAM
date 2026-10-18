import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/advisorToolLibraryInit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let state={ready:false,tools:[]};
const exports={};
vm.runInNewContext(js,{exports,require(name){
  if(name==='svelte/store')return {get:()=>state};
  if(name==='./advisorToolLibrary')return {
    advisorToolLibrary:{},
    invalidateAdvisorToolLibrary:()=>{state={ready:false,tools:[]}},
    publishAdvisorToolLibrary:tools=>{state=tools.some(tool=>tool.tipDiameterMm>tool.maxDiameterMm)?{ready:false,tools:[]}:{ready:true,tools}}
  };
  if(name==='./toolTypes')return {migrateMillingTool:tool=>tool&&typeof tool.id==='string'?tool:null};
  throw Error(name);
}});
const key=exports.TOOL_LIBRARY_STORAGE_KEY;
let raw='[{"id":"new"}]';
const storage={getItem:k=>k===key?raw:null};
state={ready:true,tools:[{id:'stale'}]};
assert.equal(exports.reloadAdvisorToolLibrary(storage),true);
assert.equal(state.ready,true);
assert.equal(state.tools[0].id,'new');
raw='broken JSON';
assert.equal(exports.reloadAdvisorToolLibrary(storage),false);
assert.equal(state.ready,false);
assert.equal(state.tools.length,0);
assert.equal(raw,'broken JSON');
raw='[{"id":"duplicate"},{"id":"duplicate"}]';
assert.equal(exports.reloadAdvisorToolLibrary(storage),false);
assert.equal(state.ready,false);
raw='[{"id":"rejected","tipDiameterMm":4,"maxDiameterMm":2}]';
assert.equal(exports.reloadAdvisorToolLibrary(storage),false);
assert.equal(state.ready,false);
assert.equal(state.tools.length,0);
raw=null;
assert.equal(exports.reloadAdvisorToolLibrary(storage),true);
assert.equal(state.ready,true);
assert.equal(state.tools.length,0);
const editor=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');
assert.match(editor,/window\.confirm\('Werkzeugbibliothek neu laden\?/);
assert.match(editor,/const ok=reloadAdvisorToolLibrary\(localStorage\)/);
assert.match(editor,/selectedToolId=null;\s*tool=createMillingTool/);
assert.match(editor,/onclick=\{reloadLibrary\}>Bibliothek neu laden/);
// Execute the real reload handler, including its early-return and state resets.
const handlerMatch=editor.match(/  function reloadLibrary\(\)\{([\s\S]*?)\n  \}\n  function exportLibrary/);
assert.ok(handlerMatch,'reloadLibrary handler must exist');
const handlerJs=ts.transpileModule('function reloadLibrary(){'+handlerMatch[1]+'\n}',{
  compilerOptions:{target:ts.ScriptTarget.ES2022}
}).outputText;
const runHandler=new Function('confirmed','reloadAdvisorToolLibrary','get','advisorToolLibrary','localStorage','createMillingTool',
  'let library=[{id:"draft"}],selectedToolId="draft",tool={id:"draft"},transferMessage="draft",applyAxial=true,applyRadial=true,reviewedContext="draft",libraryMessage="previous";'+
  'const window={confirm:()=>confirmed};'+handlerJs+
  'reloadLibrary();return {library,selectedToolId,tool,transferMessage,applyAxial,applyRadial,reviewedContext,libraryMessage};');
let reloadCalls=0;
const execute=confirmed=>runHandler(confirmed,()=>{reloadCalls++;return true;},()=>({ready:true,tools:[{id:'fresh'}]}),{},storage,()=>({id:'tool-draft'}));
const canceled=execute(false);
assert.equal(reloadCalls,0);
assert.deepEqual(canceled.library,[{id:'draft'}]);
assert.equal(canceled.selectedToolId,'draft');
assert.equal(canceled.tool.id,'draft');
assert.equal(canceled.transferMessage,'draft');
assert.equal(canceled.applyAxial,true);
assert.equal(canceled.applyRadial,true);
assert.equal(canceled.reviewedContext,'draft');
assert.equal(canceled.libraryMessage,'previous');
const accepted=execute(true);
assert.equal(reloadCalls,1);
assert.deepEqual(accepted.library,[{id:'fresh'}]);
assert.equal(accepted.selectedToolId,null);
assert.equal(accepted.tool.id,'tool-draft');
assert.equal(accepted.transferMessage,'');
assert.equal(accepted.applyAxial,false);
assert.equal(accepted.applyRadial,false);
assert.equal(accepted.reviewedContext,null);
assert.match(accepted.libraryMessage,/neu geladen/);
const rejected=runHandler(true,()=>false,()=>({ready:false,tools:[]}),{},storage,()=>({id:'tool-draft'}));
assert.doesNotMatch(rejected.libraryMessage,/neu geladen/);
assert.match(rejected.libraryMessage,/fehlgeschlagen/);
console.log('011-E5F explicit reload PASS');
