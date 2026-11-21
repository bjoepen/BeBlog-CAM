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
  vm.runInNewContext(js,{exports,require:name=>load(path.resolve(path.dirname(resolved),name)),console},{filename:resolved});
  return exports;
}
const {classifyStepManufacturingFeatures}=load('src/lib/stepFeatureClassification');
const refs=(faceIds=[],wireIds=[],edgeIds=[])=>({faceIds,wireIds,edgeIds});
const base=(featureId,kind,sourceReferences)=>({featureId,source:'step-brep',kind,classification:'geometric-candidate-requiring-interpretation',sourceReferences,evidence:[`Verified ${kind} fixture evidence.`],limitations:['Manufacturing approval is not established.']});
const inventory={version:1,source:'step-brep',orientation:{rotationXDeg:0,rotationYDeg:0,rotationZDeg:0},entries:[
  {...base('step-hole-face-1','hole',refs([1],[3,4],[9,10])),classification:'recognized-geometric-feature',recognitionEvidenceReferences:refs([1],[3,4],[9,10]),measurements:{axisOrigin:[15,5,0],axisDirection:[0,0,1],startCenter:[15,5,0],endCenter:[15,5,8],diameterMm:4,depthMm:8,termination:'unknown'}},
  {...base('step-cylinder-face-2','unclassified-cylinder',refs([2],[5],[11])),classification:'unclassified-geometry',measurements:{axisOrigin:[22,5,0],axisDirection:[0,0,1],radiusMm:1.5}},
  {...base('step-planar-face-0','planar-face',refs([0],[0,1,2],[0,1,2,3,4])),measurements:{origin:[0,0,0],normal:[0,-0.1736481777,0.984807753],wireCount:3,closedWireCount:2}},
  {...base('step-wire:0','contour-wire',refs([0],[0],[0,1,2,3])),classification:'candidate-requires-explicit-user-selection',measurements:{zMm:0,topology:'closed',areaMm2:100}},
  {...base('step-wire:2','contour-wire',refs([0],[2],[8])),classification:'candidate-requires-explicit-user-selection',measurements:{zMm:0,topology:'open',areaMm2:0}},
  {...base('step-planar-region-face-0','planar-region',refs([0],[0,1,6],[0,1,2,3,4,5,6,7,12])),classification:'candidate-requires-explicit-user-selection',measurements:{zMm:0,areaMm2:83.2146,islandCount:2}},
  {...base('step-unresolved-wire:7','unresolved-boundary',refs([0],[7],[13])),classification:'unclassified-geometry',measurements:{nativeClosed:true,resolution:'unsupported-curve'}},
  {...base('step-unresolved-wire:8','unresolved-boundary',refs([0],[8],[14,15])),classification:'unclassified-geometry',measurements:{nativeClosed:true,resolution:'geometric-closure-mismatch'}},
]};
const snapshot=JSON.stringify(inventory);
const result=classifyStepManufacturingFeatures(inventory);
assert.equal(result.ok,true);
const features=result.classification.features;
const feature=id=>features.find(item=>item.featureId===id);
const check=(name,fn)=>{fn();console.log(`PASS 011-G2: ${name}`);};

check('recognized hole preserves geometry and unresolved termination',()=>{const value=feature('step-hole-face-1');assert.equal(value.geometryKind,'hole');assert.equal(value.recognitionStatus,'recognized');assert.equal(value.confidence,'verified-conservative-recognition');assert.equal(value.geometry.termination,'unknown');assert.ok(value.unknowns.some(item=>item.kind==='feature-termination'));assert.deepEqual([...value.sourceReferences.wireIds],[3,4]);});
check('rejected cylinder remains unclassified and is not promoted to a hole',()=>{const value=feature('step-cylinder-face-2');assert.equal(value.geometryKind,'unclassified-cylinder');assert.equal(value.recognitionStatus,'unresolved');assert.equal(value.manufacturingInterpretations.length,0);});
check('planar face has multiple plausible interpretations without choosing one',()=>{const value=feature('step-planar-face-0');assert.equal(value.geometryKind,'planar-face');assert.deepEqual([...value.manufacturingInterpretations.map(item=>item.kind)],['facing-surface','pocket-floor','reference-surface']);assert.ok(value.manufacturingInterpretations.every(item=>item.status==='plausible-unproven'));assert.ok(value.unknowns.some(item=>item.kind==='manufacturing-intent'));});
check('tilted planar face remains geometry without inferred facing intent',()=>{const value=feature('step-planar-face-0');assert.notEqual(value.geometry.normal[1],0);assert.equal(value.recognitionStatus,'recognized');assert.ok(value.manufacturingInterpretations.find(item=>item.kind==='facing-surface').requiredEvidence.includes('explicit-user-interpretation'));});
check('closed contour retains topology without automatic machining intent',()=>{const value=feature('step-wire:0');assert.equal(value.geometry.topology,'closed');assert.equal(value.recognitionStatus,'candidate');assert.ok(value.unknowns.some(item=>item.kind==='inside-outside-interpretation'));});
check('open contour retains topology and explicit-selection uncertainty',()=>{const value=feature('step-wire:2');assert.equal(value.geometry.topology,'open');assert.ok(value.manufacturingInterpretations.some(item=>item.kind==='open-profile-machining'));assert.ok(value.unknowns.some(item=>item.kind==='explicit-user-selection'));});
check('valid planar region preserves islands without proven pocket intent',()=>{const value=feature('step-planar-region-face-0');assert.equal(value.geometry.islandCount,2);assert.equal(value.recognitionStatus,'candidate');assert.ok(value.manufacturingInterpretations.some(item=>item.kind==='pocket-region'));assert.ok(value.unknowns.some(item=>item.kind==='pocket-depth'));assert.ok(value.unknowns.some(item=>item.kind==='manufacturing-intent'));});
check('unsupported elliptical boundary remains unsupported and visible',()=>{const value=feature('step-unresolved-wire:7');assert.equal(value.geometry.resolution,'unsupported-curve');assert.equal(value.recognitionStatus,'unsupported');assert.equal(value.manufacturingInterpretations.length,0);assert.deepEqual([...value.sourceReferences.edgeIds],[13]);});
check('geometric closure mismatch remains unresolved and visible',()=>{const value=feature('step-unresolved-wire:8');assert.equal(value.geometry.resolution,'geometric-closure-mismatch');assert.equal(value.recognitionStatus,'unresolved');assert.equal(value.manufacturingInterpretations.length,0);});
check('stable feature identities, references and ordering are preserved',()=>{assert.deepEqual([...features.map(item=>item.featureId)],inventory.entries.map(item=>item.featureId));for(let i=0;i<features.length;i++)assert.equal(JSON.stringify(features[i].sourceReferences),JSON.stringify(inventory.entries[i].sourceReferences));});
check('identical input produces deterministic output',()=>assert.deepEqual(classifyStepManufacturingFeatures(inventory),result));
check('classification does not mutate supplied inventory',()=>assert.equal(JSON.stringify(inventory),snapshot));
check('incomplete source topology fails closed',()=>{const invalid=structuredClone(inventory);invalid.entries[3].sourceReferences.edgeIds=[];const failed=classifyStepManufacturingFeatures(invalid);assert.equal(failed.ok,false);assert.equal(failed.classification,null);assert.ok(failed.errors.some(error=>error.includes('topology')));});
check('missing or invalid classification evidence fails closed',()=>{for(const mutate of [value=>{value.entries[0].evidence=[];},value=>{value.entries[0].measurements.depthMm=NaN;},value=>{value.entries[1].featureId=value.entries[0].featureId;},value=>{value.entries[0].classification='unclassified-geometry';},value=>{value.orientation.rotationXDeg=Infinity;}]){const invalid=structuredClone(inventory);mutate(invalid);const failed=classifyStepManufacturingFeatures(invalid);assert.equal(failed.ok,false);assert.equal(failed.classification,null);}});
check('Advisor report contract remains separate and unchanged',()=>{const classifier=fs.readFileSync('src/lib/stepFeatureClassification.ts','utf8'),advisor=fs.readFileSync('src/lib/advisorStepFeasibility.ts','utf8');assert.ok(!classifier.includes("from './advisorStepFeasibility'"));assert.ok(!advisor.includes('stepFeatureClassification'));assert.ok(!JSON.stringify(result).includes('DIRECT'));assert.ok(!JSON.stringify(result).includes('NOT_COVERED'));});
check('classification creates no operation, toolpath or NC output',()=>{const serialized=JSON.stringify(result),source=fs.readFileSync('src/lib/stepFeatureClassification.ts','utf8');for(const token of ['toolpath','gcode','operationKind','spindleRpm','feedMmMin'])assert.ok(!serialized.includes(token));assert.ok(!source.includes("from './stepPocketOperation'"));assert.ok(!source.includes("from './stepContourOperation'"));});
console.log('PASS 011-G2: 16 focused classification cases');
