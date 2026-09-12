import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const types=read('src/lib/types.ts');
const panel=read('src/lib/SurfaceCarvePanel.svelte');
const state=read('src/lib/surfaceCarveOperationState.ts');
const active=read('src/lib/activeCanonicalToolpath.ts');
const preflight=read('src/lib/jobPreflight.ts');
const canonical=read('src/lib/surfaceCarveCanonicalToolpath.ts');
const gcode=read('src/lib/jobGcode.ts');
const fail=message=>{console.error(`007E contract FAIL: ${message}`);process.exit(1)};

if(!types.includes('planarGeometry?:PlanarGeometry'))fail('Surface Carve source does not retain a normalized PlanarGeometry snapshot.');
if(!panel.includes('planarGeometry:imported.planarGeometry'))fail('DXF import does not persist normalized 2D geometry into the operation-owned source.');
if(!state.includes('buildCurvedFaceTarget'))fail('Surface Carve operation state does not construct the selected STEP surface target.');
if(!state.includes('buildSurfaceCarveCanonicalToolpath'))fail('Surface Carve operation state does not route through the proven 007B canonical projection core.');
if(!state.includes("operationKind:'carve'"))fail('Normalized 2D source is not represented as a planar Carve adapter before projection.');
if(!state.includes('rotationDeg')||!state.includes('offsetX')||!state.includes('offsetY')||!state.includes('scale'))fail('Secondary geometry transform is not applied before projection.');
if(!active.includes('buildSurfaceCarveOperationState'))fail('Bearbeiten preview does not use the Surface Carve operation state.');
if(active.includes("if(operation.kind==='surface-carve')return null"))fail('Surface Carve is still blocked from canonical preview.');
if(!preflight.includes("else if(operation.kind==='surface-carve')"))fail('Job preflight does not handle Surface Carve explicitly.');
if(!preflight.includes('Die vorherige Z-Level-Schruppoperation muss den Preflight erfolgreich bestehen'))fail('Surface Carve does not require a successful preceding Z-Level operation.');
if(!preflight.includes('canonicalToolpath=state.toolpath'))fail('Surface Carve projected canonical toolpath is not admitted to normal preflight.');
if(!canonical.includes("operationKind:'surface-carve'")||!canonical.includes("strategy:'surface-carve'"))fail('Projected result lost its distinct Surface Carve canonical identity.');
if(!gcode.includes('postCanonicalMachineMotions({motions:toolpath.motions??[],operation})'))fail('Job NC no longer posts the preflight machine-motion truth generically.');
console.log('007E contract PASS: operation-owned normalized 2D geometry is transformed, projected onto the selected STEP face through 007B, admitted to preflight after successful prior Z-Level roughing, and reaches NC through the existing canonical machine-motion truth.');
