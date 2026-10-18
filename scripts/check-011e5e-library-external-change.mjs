/** 011-E5E: isolated external-storage invalidation regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/advisorToolLibraryInit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let invalidations=0;
const state={ready:true};
const exports={};
const dependencies={
  'svelte/store':{get:()=>state},
  './advisorToolLibrary':{
    advisorToolLibrary:{},
    invalidateAdvisorToolLibrary:()=>{invalidations++;state.ready=false;},
    publishAdvisorToolLibrary:()=>{state.ready=true;}
  },
  './toolTypes':{migrateMillingTool:x=>x}
};
vm.runInNewContext(js,{exports,require:name=>{
  assert.ok(Object.hasOwn(dependencies,name),name);
  return dependencies[name];
}});
assert.equal(exports.invalidateAdvisorOnExternalLibraryChange('unrelated'),false);
assert.equal(invalidations,0);
assert.equal(state.ready,true);
assert.equal(exports.invalidateAdvisorOnExternalLibraryChange(exports.TOOL_LIBRARY_STORAGE_KEY),true);
assert.equal(invalidations,1);
assert.equal(state.ready,false);
state.ready=true;
assert.equal(exports.invalidateAdvisorOnExternalLibraryChange(null),true);
assert.equal(invalidations,2);
assert.equal(state.ready,false);
console.log('011-E5E external library invalidation PASS');
