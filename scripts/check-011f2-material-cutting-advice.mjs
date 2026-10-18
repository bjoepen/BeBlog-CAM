import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const load=(path,requireFn=()=>{throw Error('Unexpected import')})=>{
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{exports,require:requireFn});
  return exports;
};
const tools=load('../src/lib/toolTypes.ts');
const feeds=load('../src/lib/feedsSpeeds.ts');
const materials=load('../src/lib/materialContext.ts',name=>{
  assert.equal(name,'svelte/store');
  return {writable:()=>({})};
});
const advice=load('../src/lib/stepCuttingAdvice.ts',name=>{
  if(name==='./materialContext')return materials;
  if(name==='./feedsSpeeds')return feeds;
  if(name==='./toolTypes')return tools;
  throw Error(name);
}).adviseStepCuttingData;
const drill=tools.createMillingTool('drill','drill-1');
const mill=tools.createMillingTool('end-mill','mill-1');
const matches=[{featureId:'hole-1',status:'conditional',candidates:[
  {toolId:drill.id,toolName:drill.name,method:'drill',reasons:['Preflight offen']},
  {toolId:mill.id,toolName:mill.name,method:'helical-mill',reasons:[]}
]}];
assert.equal(advice(matches,[drill,mill],'aluminium',false).length,0);
assert.equal(advice(matches,[drill,mill],'unknown',true).length,0);
assert.equal(advice(matches,[drill,{...drill}], 'aluminium',true).length,0);
assert.equal(advice(matches,[{...drill,cuttingLengthMm:drill.stickoutMm+1}], 'aluminium',true).length,0);
const result=advice(matches,[drill,mill],'aluminium',true);
assert.equal(result.length,2);
assert.equal(result[0].status,'conditional');
const expected=feeds.calculateFeedsSpeeds({
  toolDiameterMm:drill.diameterMm,cuttingSpeedMMin:materials.materialProfiles.aluminium.cuttingSpeedMMin,
  flutes:drill.flutes,chipLoadMm:drill.chipLoadMm*materials.materialProfiles.aluminium.chipLoadFactor
});
assert.equal(result[0].spindleRpm,expected.spindleRpm);
assert.equal(result[0].feedMmMin,expected.feedMmMin);
assert.ok(result[0].notes.some(note=>note.includes('keine Maschinen-')));
assert.equal(advice([{...matches[0],status:'none'}],[drill,mill],'aluminium',true).length,0);
assert.equal(advice(matches,[{...drill,name:'renamed'},mill],'aluminium',true).length,1);
const app=fs.readFileSync(new URL('../src/App.svelte',import.meta.url),'utf8');
const panel=fs.readFileSync(new URL('../src/lib/StepAdvisorPanel.svelte',import.meta.url),'utf8');
assert.match(app,/adviseStepCuttingData\(advisorMatches, advisorTools, \$stockMaterial, \$advisorToolLibrary.ready\)/);
assert.match(panel,/keine automatische Übernahme oder Freigabe/);
console.log('011-F2 material cutting advice PASS');
