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
    publishAdvisorToolLibrary:tools=>{state={ready:true,tools}}
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
raw=null;
assert.equal(exports.reloadAdvisorToolLibrary(storage),true);
assert.equal(state.ready,true);
assert.equal(state.tools.length,0);
const editor=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');
assert.match(editor,/window\.confirm\('Werkzeugbibliothek neu laden\?/);
assert.match(editor,/const ok=reloadAdvisorToolLibrary\(localStorage\)/);
assert.match(editor,/selectedToolId=null;\s*tool=createMillingTool/);
assert.match(editor,/onclick=\{reloadLibrary\}>Bibliothek neu laden/);
console.log('011-E5F explicit reload PASS');
