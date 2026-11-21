import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const cache=new Map();
function load(file){
  const resolved=path.resolve(file.endsWith('.ts')?file:`${file}.ts`);
  if(cache.has(resolved))return cache.get(resolved);
  const exports={};cache.set(resolved,exports);
  const js=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const localRequire=name=>name.startsWith('.')?load(path.resolve(path.dirname(resolved),name)):require(name);
  vm.runInNewContext(js,{exports,require:localRequire,console,structuredClone},{filename:resolved});
  return exports;
}
const {buildStepManufacturingFeatureInventory}=load('src/lib/stepManufacturingFeatureInventory');
const identity={rotationXDeg:0,rotationYDeg:0,rotationZDeg:0};
const line=(edgeId,start,end)=>({edgeId,kind:'line',orientation:'forward',start,end,closed:false,degenerated:false});
const circle=(edgeId,center,radiusMm)=>({edgeId,kind:'circle',orientation:'forward',start:[center[0]+radiusMm,center[1],center[2]],end:[center[0]+radiusMm,center[1],center[2]],closed:true,degenerated:false,center,axisDirection:[0,0,1],radiusMm});
const edges=[
  line(0,[0,0,0],[10,0,0]),line(1,[10,0,0],[10,10,0]),line(2,[10,10,0],[0,10,0]),line(3,[0,10,0],[0,0,0]),
  line(4,[3,3,0],[3,7,0]),line(5,[3,7,0],[7,7,0]),line(6,[7,7,0],[7,3,0]),line(7,[7,3,0],[3,3,0]),
  line(8,[0,5,0],[10,5,0]),circle(9,[15,5,0],2),circle(10,[15,5,8],2),circle(11,[22,5,0],1.5),
];
const faces=[
  {faceId:0,kind:'plane',orientation:'forward',origin:[0,0,0],normal:[0,0,1]},
  {faceId:1,kind:'cylinder',orientation:'forward',axisOrigin:[15,5,0],axisDirection:[0,0,1],radiusMm:2},
  {faceId:2,kind:'cylinder',orientation:'forward',axisOrigin:[22,5,0],axisDirection:[0,0,1],radiusMm:1.5},
];
const wires=[
  {wireId:0,faceId:0,orientation:'forward',closed:true,edgeIds:[0,1,2,3],outer:true},
  {wireId:1,faceId:0,orientation:'forward',closed:true,edgeIds:[4,5,6,7],outer:false},
  {wireId:2,faceId:0,orientation:'forward',closed:false,edgeIds:[8]},
  {wireId:3,faceId:1,orientation:'forward',closed:true,edgeIds:[9]},
  {wireId:4,faceId:1,orientation:'forward',closed:true,edgeIds:[10]},
  {wireId:5,faceId:2,orientation:'forward',closed:true,edgeIds:[11]},
];
const summary={kind:'step',fileName:'inventory-fixture.step',brep:{nativeBrep:true,faces:faces.length,edges:edges.length,manufacturingFaces:faces,manufacturingEdges:edges,manufacturingWires:wires}};
const check=(name,fn)=>{fn();console.log(`PASS 011-G1: ${name}`);};
const snapshot=JSON.stringify(summary);
const result=buildStepManufacturingFeatureInventory(summary,identity);
assert.equal(result.ok,true);
const entries=result.inventory.entries;
check('recognized hole inventory preserves native evidence',()=>{const entry=entries.find(item=>item.kind==='hole');assert.equal(entry.featureId,'step-hole-face-1');assert.deepEqual([...entry.sourceReferences.edgeIds],[9,10]);assert.equal(entry.measurements.depthMm,8);});
check('rejected cylinder remains explicitly unclassified',()=>{const entry=entries.find(item=>item.kind==='unclassified-cylinder');assert.equal(entry.featureId,'step-cylinder-face-2');assert.equal(entry.classification,'unclassified-geometry');});
check('closed contour candidate is exposed without approval',()=>{const entry=entries.find(item=>item.kind==='contour-wire'&&item.sourceReferences.wireIds[0]===0);assert.equal(entry.measurements.topology,'closed');assert.equal(entry.classification,'candidate-requires-explicit-user-selection');});
check('open contour candidate is preserved',()=>{const entry=entries.find(item=>item.kind==='contour-wire'&&item.sourceReferences.wireIds[0]===2);assert.equal(entry.measurements.topology,'open');});
check('planar region has outer boundary and islands',()=>{const entry=entries.find(item=>item.kind==='planar-region');assert.equal(entry.sourceReferences.wireIds[0],0);assert.equal(entry.measurements.islandCount,1);assert.ok(entry.measurements.areaMm2>0);});
check('horizontal planar face does not imply pocket intent',()=>{const entry=entries.find(item=>item.kind==='planar-face');assert.equal(entry.classification,'geometric-candidate-requiring-interpretation');assert.ok(entry.limitations.some(value=>value.includes('does not establish pocket')));});
check('rotated orientation is respected',()=>{const rotated=buildStepManufacturingFeatureInventory(summary,{rotationXDeg:90,rotationYDeg:0,rotationZDeg:0});assert.equal(rotated.ok,true);assert.equal(rotated.inventory.entries.filter(item=>item.kind==='contour-wire').length,0);assert.equal(rotated.inventory.entries.find(item=>item.kind==='planar-face').measurements.normal[1],-1);});
check('invalid or incomplete topology fails closed',()=>{const invalid=structuredClone(summary);invalid.brep.manufacturingWires[0].edgeIds=[999];const failed=buildStepManufacturingFeatureInventory(invalid,identity);assert.equal(failed.ok,false);assert.equal(failed.inventory,null);});
check('identical inputs produce deterministic output',()=>{assert.deepEqual(buildStepManufacturingFeatureInventory(summary,identity),result);});
check('supplied geometry is not mutated',()=>assert.equal(JSON.stringify(summary),snapshot));
check('inventory contains no operation or toolpath output',()=>{const text=JSON.stringify(result);assert.ok(!text.includes('toolpath'));assert.ok(!text.includes('operationKind'));});
check('explicit production selections remain mandatory',()=>{const contour=fs.readFileSync('src/lib/stepContourOperation.ts','utf8'),pocket=fs.readFileSync('src/lib/stepPocketOperation.ts','utf8'),drill=fs.readFileSync('src/lib/stepDrillOperation.ts','utf8');assert.ok(contour.includes('operation.stepWireId==null'));assert.ok(pocket.includes('operation.stepFaceId==null'));assert.ok(drill.includes('stepHoleFeatureIds'));});
console.log('PASS 011-G1: 12 focused inventory cases');
