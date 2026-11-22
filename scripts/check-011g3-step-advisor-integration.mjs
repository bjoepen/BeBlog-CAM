import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const cache=new Map();
function load(file){const resolved=path.resolve(file.endsWith('.ts')?file:`${file}.ts`);if(cache.has(resolved))return cache.get(resolved);const exports={};cache.set(resolved,exports);const js=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(js,{exports,require:name=>load(path.resolve(path.dirname(resolved),name)),console},{filename:resolved});return exports;}
const {classifyStepManufacturingFeatures}=load('src/lib/stepFeatureClassification');
const {captureAdvisorContext}=load('src/lib/advisorStepFeasibility');
const {buildStepAdvisorFeatureOverview}=load('src/lib/stepAdvisorFeatureOverview');
const refs=(faceIds=[],wireIds=[],edgeIds=[])=>({faceIds,wireIds,edgeIds});
const base=(featureId,kind,sourceReferences)=>({featureId,source:'step-brep',kind,classification:'geometric-candidate-requiring-interpretation',sourceReferences,evidence:[`Verified ${kind}.`],limitations:['No machining approval.']});
const inventory={version:1,source:'step-brep',orientation:{rotationXDeg:0,rotationYDeg:0,rotationZDeg:0},entries:[
  {...base('step-hole-face-1','hole',refs([1],[3,4],[9,10])),classification:'recognized-geometric-feature',recognitionEvidenceReferences:refs([1],[3,4],[9,10]),measurements:{axisOrigin:[0,0,0],axisDirection:[0,0,1],startCenter:[0,0,0],endCenter:[0,0,8],diameterMm:4,depthMm:8,termination:'unknown'}},
  {...base('step-cylinder-face-2','unclassified-cylinder',refs([2],[5],[11])),classification:'unclassified-geometry',measurements:{axisOrigin:[1,0,0],axisDirection:[0,0,1],radiusMm:2}},
  {...base('step-planar-face-6','planar-face',refs([6],[7],[20])),measurements:{origin:[0,0,0],normal:[0,0,1],wireCount:1,closedWireCount:1}},
  {...base('step-wire:7','contour-wire',refs([6],[7],[20])),classification:'candidate-requires-explicit-user-selection',measurements:{zMm:0,topology:'closed',areaMm2:100}},
  {...base('step-planar-region-face-6','planar-region',refs([6],[7,8,9],[20,21,22])),classification:'candidate-requires-explicit-user-selection',measurements:{zMm:0,areaMm2:80,islandCount:2}},
  {...base('step-unresolved-wire:10','unresolved-boundary',refs([6],[10],[23])),classification:'unclassified-geometry',measurements:{nativeClosed:true,resolution:'unsupported-curve'}},
]};
const classificationResult=classifyStepManufacturingFeatures(inventory);assert.equal(classificationResult.ok,true);
const inventoryResult={ok:true,inventory,errors:[]};
const context={geometryIdentity:`sha256:${'a'.repeat(64)}`,capabilityRevision:'011-G3-test',summary:{kind:'step',status:'ready',fileName:'fixture.step',sourceContentSha256:'a'.repeat(64),brep:{nativeBrep:true}},orientation:{...inventory.orientation},stockMode:'manual',stockSnapshot:{width:20,height:20,thickness:10},wcs:{origin:'stock-min',z:'top'},material:'aluminum',tools:[{id:'drill-4',name:'Drill 4',kind:'drill',diameterMm:4,stickoutMm:20,cuttingLengthMm:12}]};
const report={version:1,status:'screened',sourceFileName:'fixture.step',material:'aluminum',features:[{featureId:'step-hole-face-1',kind:'hole',faceIds:[1],diameterMm:4,depthMm:8,coverage:'CONDITIONAL',strategies:[],reasons:[]},{featureId:'step-cylinder-face-2',kind:'unclassified-cylinder',faceIds:[2],coverage:'UNKNOWN',strategies:[],reasons:['Conservative recognition failed.']}],notes:[]};
const reviewedContext=captureAdvisorContext(context);assert.ok(reviewedContext);
const args={inventoryResult,classificationResult,report,reviewedContext,currentContext:context};
const result=buildStepAdvisorFeatureOverview(args);assert.equal(result.ok,true);
const check=(name,fn)=>{fn();console.log(`PASS 011-G3: ${name}`);};
const fail=patch=>buildStepAdvisorFeatureOverview({...args,...patch});

check('valid G1 to G2 to Advisor presentation pipeline',()=>assert.equal(result.overview.features.length,6));
check('all six feature kinds remain visible and deterministically ordered',()=>assert.deepEqual([...result.overview.features.map(item=>item.classification.geometryKind)],['hole','unclassified-cylinder','planar-face','contour-wire','planar-region','unresolved-boundary']));
check('stable feature identities and native references are preserved',()=>result.overview.features.forEach((item,index)=>{assert.equal(item.featureId,inventory.entries[index].featureId);assert.equal(JSON.stringify(item.classification.sourceReferences),JSON.stringify(inventory.entries[index].sourceReferences));}));
check('multiple plausible interpretations remain unchosen',()=>{const feature=result.overview.features[2].classification;assert.ok(feature.manufacturingInterpretations.length>1);assert.ok(feature.manufacturingInterpretations.every(item=>item.status==='plausible-unproven'));});
check('recognized hole receives only verified matching feasibility',()=>{const value=result.overview.features[0].feasibility;assert.equal(value.status,'assessed');assert.equal(value.assessment.coverage,'CONDITIONAL');});
check('hole with missing or mismatched feasibility is not assessed',()=>{for(const features of [[],[{...report.features[0],faceIds:[99]}]]){const value=buildStepAdvisorFeatureOverview({...args,report:{...report,features}});assert.equal(value.ok,true);assert.equal(value.overview.features[0].feasibility.status,'not-assessed');}});
check('non-hole feature is not assessed rather than NOT_COVERED',()=>{for(const index of [2,3,4,5]){const value=result.overview.features[index].feasibility;assert.equal(value.status,'not-assessed');assert.ok(!JSON.stringify(value).includes('NOT_COVERED'));}});
check('unsupported boundary remains unresolved without interpretation',()=>{const value=result.overview.features[5].classification;assert.equal(value.recognitionStatus,'unsupported');assert.equal(value.manufacturingInterpretations.length,0);});
check('failed G1 inventory is unavailable',()=>{const value=fail({inventoryResult:{ok:false,inventory:null,errors:['G1 failed.']}});assert.equal(value.ok,false);assert.ok(value.errors.includes('G1 failed.'));});
check('failed G2 classification is unavailable',()=>{const value=fail({classificationResult:{ok:false,classification:null,errors:['G2 failed.']}});assert.equal(value.ok,false);assert.ok(value.errors.includes('G2 failed.'));});
check('missing Advisor context and report fail closed',()=>{assert.equal(fail({currentContext:null}).ok,false);assert.equal(fail({reviewedContext:null}).ok,false);assert.equal(fail({report:null}).ok,false);});
check('geometry identity and orientation changes invalidate associations',()=>{for(const currentContext of [{...context,geometryIdentity:`sha256:${'b'.repeat(64)}`},{...context,orientation:{...context.orientation,rotationXDeg:10}}])assert.equal(fail({currentContext}).ok,false);});
check('stock WCS material tool and capability changes invalidate associations',()=>{const variants=[{...context,stockSnapshot:{...context.stockSnapshot,width:21}},{...context,wcs:{...context.wcs,z:'center'}},{...context,material:'steel'},{...context,tools:[]},{...context,capabilityRevision:'changed'}];for(const currentContext of variants)assert.equal(fail({currentContext}).ok,false);});
check('invalid G1/G2 linkage fails closed',()=>{const classification=structuredClone(classificationResult);classification.classification.features[0].sourceReferences.wireIds=[99];assert.equal(fail({classificationResult:classification}).ok,false);});
check('identical input is deterministic and immutable',()=>{const before=JSON.stringify(args);assert.deepEqual(buildStepAdvisorFeatureOverview(args),result);assert.equal(JSON.stringify(args),before);});
check('no stale UI result survives context changes',()=>{assert.equal(fail({currentContext:{...context,capabilityRevision:'next'}}).overview,null);const app=fs.readFileSync('src/App.svelte','utf8');assert.ok(app.includes('$: advisorFeatureOverview = buildStepAdvisorFeatureOverview'));assert.ok(app.includes('reviewedContext:advisorReviewedContext,currentContext:advisorContext'));});
check('adapter and UI create no operation toolpath or NC output',()=>{const source=fs.readFileSync('src/lib/stepAdvisorFeatureOverview.ts','utf8');for(const token of ['addOperation','replaceOperation','buildActiveCanonicalToolpath','generateGCode'])assert.ok(!source.includes(token));assert.ok(!JSON.stringify(result).includes('gcode'));});
check('existing Advisor report remains unchanged',()=>assert.equal(JSON.stringify(report),JSON.stringify(args.report)));
check('inspector presents geometry interpretations uncertainty and separate feasibility',()=>{const panel=fs.readFileSync('src/lib/StepAdvisorPanel.svelte','utf8');for(const text of ['Feature-Übersicht','Mögliche Interpretationen · nicht bewiesen','Unbekannt / offen','Feasibility · bestehende Advisor-Vorprüfung','Feasibility: nicht bewertet'])assert.ok(panel.includes(text));assert.ok(!panel.includes('confidencePercent'));});
check('explicit production selection contracts remain untouched',()=>{const source=fs.readFileSync('src/lib/stepAdvisorFeatureOverview.ts','utf8');for(const selector of ['stepWireId','stepFaceId','stepHoleFeatureIds'])assert.ok(!source.includes(selector));});
console.log('PASS 011-G3: 20 focused Advisor integration cases');
