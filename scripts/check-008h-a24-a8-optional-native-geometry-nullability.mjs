import fs from 'node:fs';
import ts from 'typescript';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(`008H-A24-A8 contract failed: ${message}`);};
const rust=read('src-tauri/src/occt.rs');
const features=read('src/lib/stepManufacturingFeatures.ts');
const pkg=JSON.parse(read('package.json'));
const workflow=read('.github/workflows/ci.yml');

assert(rust.includes('#[serde(default, skip_serializing_if = "Option::is_none")] pub degenerated_point: Option<[f64; 3]>'),'degenerated_point must preserve default deserialization and omit only None during serialization');
assert((rust.match(/skip_serializing_if\s*=\s*"Option::is_none"/g)??[]).length===1,'A8 must not alter any other Option<T> serialization contract');
assert(features.includes('degeneratedPoint?:Point3Tuple'),'frontend absence must remain field-missing/undefined');
assert(features.includes("if(edge.degenerated&&!finite3(edge.degeneratedPoint))"),'degenerated edge without a real point must remain fail-closed');
assert(features.includes("if(!edge.degenerated&&edge.degeneratedPoint!==undefined)"),'regular edge with a real point must remain fail-closed');

const orientationSource=read('src/lib/partOrientation.ts');
const orientationJs=ts.transpileModule(orientationSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const orientationUrl=`data:text/javascript;base64,${Buffer.from(orientationJs).toString('base64')}`;
const featureJs=ts.transpileModule(features,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./partOrientation'",JSON.stringify(orientationUrl));
const {buildStepManufacturingFeatureSource}=await import(`data:text/javascript;base64,${Buffer.from(featureJs).toString('base64')}`);

const point=[1,2,3];
const edgeBase={edgeId:0,kind:'line',orientation:'forward',start:[0,0,0],end:[1,0,0],closed:false};
const summary=edge=>({kind:'step',brep:{nativeBrep:true,faces:1,edges:1,manufacturingFaces:[{faceId:0,kind:'sphere',orientation:'forward',center:[0,0,0],axisDirection:[0,0,1],xDirection:[1,0,0],yDirection:[0,1,0],radiusMm:10}],manufacturingEdges:[edge],manufacturingWires:[{wireId:0,faceId:0,orientation:'forward',closed:true,outer:true,edgeIds:[0]}]}});

const regular=buildStepManufacturingFeatureSource(summary({...edgeBase,degenerated:false}));
assert(regular.ok,'non-degenerated edge with absent/undefined degeneratedPoint must remain valid');
assert(regular.source.edges[0].degeneratedPoint===undefined,'frontend manufacturing source must retain canonical undefined absence');

const degenerated=buildStepManufacturingFeatureSource(summary({...edgeBase,kind:'other',start:point,end:point,closed:true,degenerated:true,degeneratedPoint:point}));
assert(degenerated.ok&&JSON.stringify(degenerated.source.edges[0].degeneratedPoint)===JSON.stringify(point),'degenerated edge Some(point) must remain complete');

const missingPoint=buildStepManufacturingFeatureSource(summary({...edgeBase,kind:'other',start:point,end:point,closed:true,degenerated:true}));
assert(!missingPoint.ok&&missingPoint.errors.some(error=>error.includes('native Lage der degenerierten Kante fehlt oder ist ungültig.')),'degenerated edge without point must remain fail-closed');

const contradictoryPoint=buildStepManufacturingFeatureSource(summary({...edgeBase,degenerated:false,degeneratedPoint:point}));
assert(!contradictoryPoint.ok&&contradictoryPoint.errors.some(error=>error.includes('nicht degenerierte Kante darf keine Degenerated-Location tragen.')),'non-degenerated edge with a real point must remain fail-closed');

assert(pkg.scripts['check:008h-a24-a8']==='node scripts/check-008h-a24-a8-optional-native-geometry-nullability.mjs','package script must execute the A8 checker');
assert(workflow.includes('run: pnpm check:008h-a24-a8'),'CI must execute the A8 proof');

console.log('008H-A24-A8 optional native geometry nullability integrity PASS');
