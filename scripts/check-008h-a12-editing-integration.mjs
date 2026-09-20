import fs from 'node:fs';

const app=fs.readFileSync('src/App.svelte','utf8');
const view=fs.readFileSync('src/lib/GeometryView.svelte','utf8');

function requireText(source,text,message){if(!source.includes(text))throw new Error(message);}
function forbidText(source,text,message){if(source.includes(text))throw new Error(message);}

requireText(app,"threeDRoughingOperation={activeStep==='Bearbeiten'&&operation.kind==='3d-roughing'?operation:null}",'008H-A12 contract failed: App must pass the active 3D roughing operation into GeometryView');
requireText(view,'export let threeDRoughingOperation:ThreeDRoughingOperation|null=null;','008H-A12 contract failed: GeometryView needs an explicit 3D roughing editing context');
requireText(view,'$: threeDRoughingEditing=!!threeDRoughingOperation;','008H-A12 contract failed: GeometryView must expose 3D roughing editing state');
requireText(view,'$: selectableSurfaceEditing=faceTargetEditing||threeDRoughingEditing||surfaceFinishingEditing;','008H-A12 contract failed: 3D roughing must share free BRep face picking with 3D finishing');
requireText(view,"if(!selectableSurfaceEditing||(!threeDRoughingEditing&&!surfaceFinishingEditing&&!showZLevels))return;",'008H-A12 contract failed: 3D roughing face picking must not depend on legacy Z-level visibility');
forbidText(app,'der eigentliche 3D-Schrupp-Kernel folgt in einem späteren Teilbuild','008H-A12 contract failed: obsolete A1 kernel note remains');
forbidText(app,'A1 erzeugt für 3D Schruppen noch keinen Manufacturing-Toolpath','008H-A12 contract failed: obsolete A1 manufacturing lock note remains');

console.log('008H-A12 3D roughing editing integration contract PASS');
