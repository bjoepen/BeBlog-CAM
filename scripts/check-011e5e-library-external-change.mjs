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

// Verify the actual App listener and editor save guard, not merely the helper.
// Extract executable source fragments so deleting either integration breaks this test.
const app=fs.readFileSync(new URL('../src/App.svelte',import.meta.url),'utf8');
const editor=fs.readFileSync(new URL('../src/lib/FeedsSpeedsCalculatorCore.svelte',import.meta.url),'utf8');
const listenerMatch=app.match(/const onStorage = \(event: StorageEvent\) => \{([\s\S]*?)\n    \};/);
assert.ok(listenerMatch,'App storage event listener must exist');
assert.match(app,/window\.addEventListener\('storage', onStorage\)/,'App must register listener');
assert.match(app,/window\.removeEventListener\('storage', onStorage\)/,'App must remove listener');
const listener= new Function('event','localStorage','invalidateAdvisorOnExternalLibraryChange',
  listenerMatch[1]);
const persistMatch=editor.match(/  function persist\(next:MillingTool\[\]\):boolean\{([\s\S]*?)\n  \}\n  function setSpindlePreset/);
assert.ok(persistMatch,'Editor persist must exist');
const persistJs=ts.transpileModule(
  'function persist(next: unknown[]): boolean {'+persistMatch[1]+'\n}',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}
).outputText;
const persisted=new Map([[exports.TOOL_LIBRARY_STORAGE_KEY,'[{"id":"original"}]']]);
const storage={
  getItem:key=>persisted.get(key)??null,
  setItem:(key,value)=>persisted.set(key,value),
  clear:()=>persisted.clear()
};
const actualStore={
  ready:true,
  tools:[{id:'original'}]
};
const storeGet=()=>actualStore;
const storePublish=entries=>{actualStore.ready=true;actualStore.tools=entries;};
const editorPersist=new Function('next','get','advisorToolLibrary','publishAdvisorToolLibrary','localStorage','STORAGE_KEY',
  'let library=[];let libraryMessage="";'+persistJs+'return {saved:persist(next),message:libraryMessage};');
const simulateSave=()=>editorPersist([{id:'stale'}],storeGet,{},storePublish,storage,exports.TOOL_LIBRARY_STORAGE_KEY);
const dispatch=key=>listener({key,storageArea:storage},storage,matchedKey=>{
  const changed=exports.invalidateAdvisorOnExternalLibraryChange(matchedKey);
  if(changed)actualStore.ready=false;
  return changed;
});
// Unrelated storage key leaves editor operable.
dispatch('unrelated');
assert.equal(actualStore.ready,true);
assert.equal(simulateSave().saved,true);
assert.match(storage.getItem(exports.TOOL_LIBRARY_STORAGE_KEY),/stale/);
// External update is authoritative; stale save must be denied without writes.
storage.setItem(exports.TOOL_LIBRARY_STORAGE_KEY,'[{"id":"external"}]');
dispatch(exports.TOOL_LIBRARY_STORAGE_KEY);
assert.equal(actualStore.ready,false);
assert.equal(simulateSave().saved,false);
assert.equal(storage.getItem(exports.TOOL_LIBRARY_STORAGE_KEY),'[{"id":"external"}]');
// localStorage.clear() emits event.key=null; stale editor must not recreate it.
actualStore.ready=true;
storage.clear();
dispatch(null);
assert.equal(actualStore.ready,false);
assert.equal(simulateSave().saved,false);
assert.equal(storage.getItem(exports.TOOL_LIBRARY_STORAGE_KEY),null);
console.log('011-E5E external library event -> stale save regression PASS');
