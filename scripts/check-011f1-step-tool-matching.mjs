import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/stepToolMatching.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports,require(name){
  assert.equal(name,'./toolTypes');
  return {isMillingTool:tool=>tool?.valid===true};
}});
const match=exports.matchStepTools;
const tools=[{id:'d1',name:'Bohrer',valid:true},{id:'e1',name:'Fräser',valid:true}];
const report={status:'screened',features:[
  {featureId:'hole-1',kind:'hole',strategies:[
    {toolId:'e1',toolName:'Fräser',method:'helical-mill',status:'conditional',reasons:['Helix nicht geprüft']},
    {toolId:'d1',toolName:'Bohrer',method:'drill',status:'candidate',reasons:['Preflight ausstehend']}
  ],reasons:[]},
  {featureId:'cyl-1',kind:'unclassified-cylinder',strategies:[],reasons:[]}
]};
assert.equal(match(report,tools,false).length,0);
assert.equal(match({...report,status:'unavailable'},tools,true).length,0);
assert.equal(match(report,[...tools,{...tools[0]}],true).length,0);
assert.equal(match(report,[{...tools[0],valid:false}],true).length,0);
const result=match(report,tools,true);
assert.equal(result.length,2);
assert.equal(result[0].status,'conditional');
assert.equal(result[0].candidates.length,2);
assert.equal(result[0].candidates[0].toolId,'d1');
assert.equal(result[1].status,'none');
assert.equal(result[1].candidates.length,0);
const stale=match(report,[{...tools[0],name:'Umbenannt'},tools[1]],true);
assert.equal(stale[0].candidates.length,1);
assert.equal(stale[0].candidates[0].toolId,'e1');
const app=fs.readFileSync(new URL('../src/App.svelte',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../src/lib/StepAdvisorPanel.svelte',import.meta.url),'utf8');
assert.match(app,/matchStepTools\(advisorReport, advisorTools, \$advisorToolLibrary.ready\)/);
assert.match(app,/matches=\{advisorMatches\}/);
assert.match(panel,/keine Freigabe/);
console.log('011-F1 STEP tool matching PASS');
