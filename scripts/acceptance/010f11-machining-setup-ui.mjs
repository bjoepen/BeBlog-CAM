import fs from 'node:fs';
const app=fs.readFileSync('src/App.svelte','utf8');
const overlay=fs.readFileSync('src/lib/ContourOverlay.svelte','utf8');
const expect=(ok,message)=>{if(!ok)throw new Error(message)};
for(const token of [
  'updateSpoilboardThickness','value={spoilboardThicknessMm}','spoilboardThicknessMm=value',
  "operation.kind==='trochoidal-contour-roughing'","updateTrochoidal({contourId:id})",
  "appendOperation('trochoidal-contour-roughing')","setOperationKind('trochoidal-contour-roughing')",
  "kind==='trochoidal-contour-roughing')setOperation({...defaultTrochoidalContourContract",
  "updateTrochoidal({side:'outside'})","updateTrochoidal({side:'inside'})",
  "updateTrochoidal({direction:'climb'})","updateTrochoidal({direction:'conventional'})",
  "updateTrochoidalNumber('trochoidRadiusMm'","updateTrochoidalNumber('forwardStepMm'",
  "updateTrochoidal({depthMode:'stock-bottom'})","updateTrochoidal({depthMode:'manual',overcutMm:0})",
  "updateTrochoidalNumber('overcutMm'","updateTrochoidalNumber('radialAllowanceMm'","updateTrochoidalNumber('axialAllowanceMm'",
  "updateNumber('totalDepthMm'","updateNumber('stepDownMm'","updateNumber('rampAngleDeg'"
])expect(app.includes(token),'missing F11 UI binding: '+token);
for(const token of [
  "operation.kind==='trochoidal-contour-roughing'",
  "return{kind:'trochoid' as const,closed:cs.map",
  "{:else if scene.kind==='trochoid'}",
  "onclick={()=>chooseClosed(chain.id)}"
])expect(overlay.includes(token),'missing F11 trochoidal contour selection reachability: '+token);
expect(app.includes('createCamProjectV1({sourcePath,sourceFileName:importSummary.fileName,stock,stockMode,spoilboardThicknessMm'),'spoilboard save authority');
expect(app.includes('spoilboardThicknessMm=project.setup.spoilboardThicknessMm??0'),'spoilboard load authority');
expect(app.includes('validateJob({summary:importSummary,stock,stockMode,placement,orientation,wcs,operations:operationsProject.operations,fixtures,spoilboardThicknessMm'),'spoilboard preflight authority');
console.log('010-F11 machining setup UI: PASS');
