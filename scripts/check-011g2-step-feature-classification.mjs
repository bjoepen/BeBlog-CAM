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
const expectStructuredFailure=value=>{let failed;assert.doesNotThrow(()=>{failed=classifyStepManufacturingFeatures(value);});assert.equal(failed.ok,false);assert.equal(failed.classification,null);assert.ok(Array.isArray(failed.errors)&&failed.errors.length>0);return failed;};

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
check('null and undefined inventory fail structurally without exceptions',()=>{expectStructuredFailure(null);expectStructuredFailure(undefined);});
check('missing entries array fails structurally without exceptions',()=>{const invalid=structuredClone(inventory);delete invalid.entries;expectStructuredFailure(invalid);});
check('null entry fails structurally without exceptions',()=>{const invalid=structuredClone(inventory);invalid.entries[2]=null;expectStructuredFailure(invalid);});
check('missing and empty feature identities fail closed',()=>{for(const featureId of [undefined,'']){const invalid=structuredClone(inventory);if(featureId===undefined)delete invalid.entries[0].featureId;else invalid.entries[0].featureId=featureId;expectStructuredFailure(invalid);}});
check('duplicate feature identities return structured failure',()=>{const invalid=structuredClone(inventory);invalid.entries[1].featureId=invalid.entries[0].featureId;const failed=expectStructuredFailure(invalid);assert.ok(failed.errors.some(error=>error.includes('duplicate')));});
check('missing and null sourceReferences fail structurally',()=>{for(const sourceReferences of [undefined,null]){const invalid=structuredClone(inventory);if(sourceReferences===undefined)delete invalid.entries[0].sourceReferences;else invalid.entries[0].sourceReferences=sourceReferences;expectStructuredFailure(invalid);}});
check('malformed source reference arrays fail closed',()=>{for(const sourceReferences of [{faceIds:null,wireIds:[],edgeIds:[]},{faceIds:[1],wireIds:'3',edgeIds:[9]},{faceIds:[1,1],wireIds:[3],edgeIds:[9]}]){const invalid=structuredClone(inventory);invalid.entries[0].sourceReferences=sourceReferences;expectStructuredFailure(invalid);}});
check('missing and null recognition evidence references fail structurally',()=>{for(const recognitionEvidenceReferences of [undefined,null]){const invalid=structuredClone(inventory);if(recognitionEvidenceReferences===undefined)delete invalid.entries[0].recognitionEvidenceReferences;else invalid.entries[0].recognitionEvidenceReferences=recognitionEvidenceReferences;expectStructuredFailure(invalid);}});
check('missing and null measurements fail for every feature kind',()=>{for(let index=0;index<inventory.entries.length;index++)for(const measurements of [undefined,null]){const invalid=structuredClone(inventory);if(measurements===undefined)delete invalid.entries[index].measurements;else invalid.entries[index].measurements=measurements;expectStructuredFailure(invalid);}});
check('invalid feature discriminant fails semantically',()=>{const invalid=structuredClone(inventory);invalid.entries[0].kind='mystery-geometry';expectStructuredFailure(invalid);});
check('invalid classification discriminant fails semantically',()=>{const invalid=structuredClone(inventory);invalid.entries[0].classification='DIRECT';expectStructuredFailure(invalid);});
check('missing and malformed evidence fail closed',()=>{for(const evidence of [undefined,null,'verified',[42],[]]){const invalid=structuredClone(inventory);if(evidence===undefined)delete invalid.entries[0].evidence;else invalid.entries[0].evidence=evidence;expectStructuredFailure(invalid);}});
check('missing and malformed limitations fail closed',()=>{for(const limitations of [undefined,null,'none',[42]]){const invalid=structuredClone(inventory);if(limitations===undefined)delete invalid.entries[0].limitations;else invalid.entries[0].limitations=limitations;expectStructuredFailure(invalid);}});
check('invalid orientation shapes and values fail structurally',()=>{for(const orientation of [undefined,null,{}, {rotationXDeg:NaN,rotationYDeg:0,rotationZDeg:0},{rotationXDeg:0,rotationYDeg:'0',rotationZDeg:0}]){const invalid=structuredClone(inventory);if(orientation===undefined)delete invalid.orientation;else invalid.orientation=orientation;expectStructuredFailure(invalid);}});
check('nonfinite measurements for every numeric feature family fail closed',()=>{for(const [index,field] of [[0,'depthMm'],[1,'radiusMm'],[2,'wireCount'],[3,'areaMm2'],[5,'areaMm2']]){const invalid=structuredClone(inventory);invalid.entries[index].measurements[field]=Infinity;expectStructuredFailure(invalid);}});
check('malformed input error ordering is deterministic',()=>{const invalid=structuredClone(inventory);invalid.orientation=null;invalid.entries[0].sourceReferences=null;invalid.entries[1]=null;const first=expectStructuredFailure(invalid),second=expectStructuredFailure(invalid);assert.deepEqual([...first.errors],[...second.errors]);});
console.log('PASS 011-G2: 32 focused classification cases');
