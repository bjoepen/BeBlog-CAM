import fs from 'node:fs';

function replaceOnce(path,from,to,label){
  let text=fs.readFileSync(path,'utf8');
  if(!text.includes(from))throw new Error(`${label}: anchor missing`);
  text=text.replace(from,to);
  fs.writeFileSync(path,text);
}

// 1) Persist explicit island semantics on Z-level face-target operations.
const types='src/lib/types.ts';
replaceOnce(types,
  "export type DrillMethod='drill'|'helical-mill';export type ZLevelRoughingMode='face-target'|'model';export type FacingDirection='x'|'y';",
  "export type DrillMethod='drill'|'helical-mill';export type ZLevelRoughingMode='face-target'|'model';export type ZLevelIslandMode='preserve'|'clear';export type FacingDirection='x'|'y';",
  'Z-level island mode type');
replaceOnce(types,
  "export interface ZLevelRoughingOperation extends BaseOperation{kind:'z-level-roughing';faceIds:number[];roughingMode?:ZLevelRoughingMode;stepoverPercent:number;finishAllowanceMm:number;}",
  "export interface ZLevelRoughingOperation extends BaseOperation{kind:'z-level-roughing';faceIds:number[];roughingMode?:ZLevelRoughingMode;islandMode?:ZLevelIslandMode;stepoverPercent:number;finishAllowanceMm:number;}",
  'Z-level island mode persistence');
replaceOnce(types,
  "faceIds:[],roughingMode:'face-target',tool:{id:'tool-roughing-1'",
  "faceIds:[],roughingMode:'face-target',islandMode:'preserve',tool:{id:'tool-roughing-1'",
  'Z-level island default');

// 2) Face-target region: preserve all loops or intentionally fill internal islands.
const rough='src/lib/faceTargetRoughing.ts';
let r=fs.readFileSync(rough,'utf8');
r=r.replace(
`export type FaceTargetRoughing = {\n  targetZ: number;\n  roughBottomZ: number;\n  stockTopZ: number;\n  levels: number[];\n  loops: FaceTargetLoop[];\n};`,
`export type FaceTargetRoughing = {\n  targetZ: number;\n  roughBottomZ: number;\n  stockTopZ: number;\n  levels: number[];\n  loops: FaceTargetLoop[];\n  islandMode:'preserve'|'clear';\n  boundaryLoopCount:number;\n  islandLoopCount:number;\n};`);
const helperAnchor=`function levels(stockTop:number,roughBottom:number,stepDown:number):number[]{`;
const helpers=`function pointInLoop(loop:FaceTargetLoop,p:{x:number;y:number}){\n  let inside=false;const poly=loop.points;\n  for(let i=0,j=poly.length-1;i<poly.length;j=i++){\n    const a=poly[i],b=poly[j];\n    const hit=((a.y>p.y)!==(b.y>p.y))&&p.x<((b.x-a.x)*(p.y-a.y))/(b.y-a.y||Number.EPSILON)+a.x;\n    if(hit)inside=!inside;\n  }\n  return inside;\n}\n\nfunction interiorPoint(loop:FaceTargetLoop){\n  const pts=loop.points;if(!pts.length)return{x:0,y:0};\n  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);\n  const candidates=[\n    {x:pts.reduce((s,p)=>s+p.x,0)/pts.length,y:pts.reduce((s,p)=>s+p.y,0)/pts.length},\n    {x:(minX+maxX)/2,y:(minY+maxY)/2},\n  ];\n  for(const p of candidates)if(pointInLoop(loop,p))return p;\n  for(let iy=1;iy<10;iy++)for(let ix=1;ix<10;ix++){const p={x:minX+(maxX-minX)*ix/10,y:minY+(maxY-minY)*iy/10};if(pointInLoop(loop,p))return p;}\n  return pts[0];\n}\n\nfunction outerBoundaryLoops(loops:FaceTargetLoop[]){\n  return loops.filter((loop,index)=>{\n    const p=interiorPoint(loop);\n    return !loops.some((other,otherIndex)=>otherIndex!==index&&pointInLoop(other,p));\n  });\n}\n\n${helperAnchor}`;
if(!r.includes(helperAnchor))throw new Error('face target helper anchor missing');
r=r.replace(helperAnchor,helpers);
r=r.replace(
`  finishAllowanceMm:number,\n):FaceTargetRoughing|null{`,
`  finishAllowanceMm:number,\n  islandMode:'preserve'|'clear'='preserve',\n):FaceTargetRoughing|null{`);
r=r.replace(
`  const roughBottomZ=targetZ+Math.max(0,finishAllowanceMm);\n  const loops=boundaryLoops(part,faceIds,selected);\n  if(!loops.length)return null;\n  return{targetZ,roughBottomZ,stockTopZ,levels:levels(stockTopZ,roughBottomZ,stepDownMm),loops};`,
`  const roughBottomZ=targetZ+Math.max(0,finishAllowanceMm);\n  const allLoops=boundaryLoops(part,faceIds,selected);\n  if(!allLoops.length)return null;\n  const outerLoops=outerBoundaryLoops(allLoops);\n  if(!outerLoops.length)return null;\n  const islandLoopCount=Math.max(0,allLoops.length-outerLoops.length);\n  const loops=islandMode==='clear'?outerLoops:allLoops;\n  return{targetZ,roughBottomZ,stockTopZ,levels:levels(stockTopZ,roughBottomZ,stepDownMm),loops,islandMode,boundaryLoopCount:allLoops.length,islandLoopCount};`);
fs.writeFileSync(rough,r);

// 3) Route operation setting into the canonical face-target kernel and expose metadata.
const faceOp='src/lib/faceTargetOperation.ts';
replaceOnce(faceOp,
`export type FaceTargetOperationState={\n  toolpath:CanonicalToolpath;\n  targetZ:number;\n  roughBottomZ:number;\n  levelCount:number;\n};`,
`export type FaceTargetOperationState={\n  toolpath:CanonicalToolpath;\n  targetZ:number;\n  roughBottomZ:number;\n  levelCount:number;\n  islandMode:'preserve'|'clear';\n  islandLoopCount:number;\n};`,
'face target state island metadata');
replaceOnce(faceOp,
`    Math.max(0,operation.finishAllowanceMm),\n  );`,
`    Math.max(0,operation.finishAllowanceMm),\n    operation.islandMode??'preserve',\n  );`,
'face target forwards island mode');
replaceOnce(faceOp,
`    levelCount:target.levels.length,\n  };`,
`    levelCount:target.levels.length,\n    islandMode:target.islandMode,\n    islandLoopCount:target.islandLoopCount,\n  };`,
'face target returns island metadata');

// 4) Make the decision visible in canonical preflight warnings.
const zlevel='src/lib/zLevelOperationState.ts';
replaceOnce(zlevel,
`      errors:[],\n      warnings:[],\n      targetZ:planar.targetZ,`,
`      errors:[],\n      warnings:planar.islandLoopCount?[
        planar.islandMode==='clear'
          ?\`004Z-B: ${planar.islandLoopCount} Inneninsel${planar.islandLoopCount===1?'':'n'} wird/werden bis zur Zielfläche mit geschruppt.\`
          :\`004Z-B: ${planar.islandLoopCount} Inneninsel${planar.islandLoopCount===1?'':'n'} bleibt/bleiben beim Flächenschruppen stehen.\`
      ]:[],\n      targetZ:planar.targetZ,`,
'Z-level island warning');

// 5) UI: explicit, calm decision only for Face Target.
const app='src/App.svelte';
const uiAnchor=`{#if zLevelMode(operation)==='face-target'}<p class="note">Wähle mindestens eine horizontale oder schräge STEP-Face als fachliches Schruppziel. Die ausgewählten Flächen bestimmen die Zielregion und Z-Tiefe.</p>{#if operation.faceIds.length}<p class="note"><strong>Auswahl:</strong> {operation.faceIds.length} Face{operation.faceIds.length===1?'':'s'}.</p>{/if}{:else}`;
const uiNext=`{#if zLevelMode(operation)==='face-target'}<p class="note">Wähle mindestens eine horizontale oder schräge STEP-Face als fachliches Schruppziel. Die ausgewählten Flächen bestimmen die Zielregion und Z-Tiefe.</p><p class="placement-title">Inneninseln</p><div class="placement-grid two"><button class:active={(operation.islandMode??'preserve')==='preserve'} onclick={()=>updateZLevelRoughing({islandMode:'preserve'})}>Stehen lassen</button><button class:active={(operation.islandMode??'preserve')==='clear'} onclick={()=>updateZLevelRoughing({islandMode:'clear'})}>Mit schruppen</button></div><p class="note">„Stehen lassen“ respektiert Bohrungen und innere Aussparungen als Inseln. „Mit schruppen“ füllt diese Innenkonturen für die Schruppregion und räumt das Material bis zur gewählten Zielfläche ab.</p>{#if operation.faceIds.length}<p class="note"><strong>Auswahl:</strong> {operation.faceIds.length} Face{operation.faceIds.length===1?'':'s'}.</p>{/if}{:else}`;
replaceOnce(app,uiAnchor,uiNext,'004Z-B island UI');

// 6) Operation summary + job-preflight detail show the chosen semantics.
const ops='src/lib/operationsProject.ts';
replaceOnce(ops,
`    return \`${'${source}'} · ${'${operation.stepDownMm.toLocaleString(\'de-DE\',{maximumFractionDigits:3})}'} mm Zustellung · ${'${operation.stepoverPercent}'}% Stepover · ${'${operation.finishAllowanceMm.toLocaleString(\'de-DE\',{maximumFractionDigits:3})}'} mm Aufmaß · ${'${tool}'}\`;`,
`    const islands=(operation.islandMode??'preserve')==='clear'?'Inseln mit schruppen':'Inseln stehen lassen';\n    return \`${'${source}'} · ${'${islands}'} · ${'${operation.stepDownMm.toLocaleString(\'de-DE\',{maximumFractionDigits:3})}'} mm Zustellung · ${'${operation.stepoverPercent}'}% Stepover · ${'${operation.finishAllowanceMm.toLocaleString(\'de-DE\',{maximumFractionDigits:3})}'} mm Aufmaß · ${'${tool}'}\`;`,
'operation summary island semantics');

const preflight='src/lib/jobPreflight.ts';
replaceOnce(preflight,
`else if(operation.kind==='z-level-roughing'){const mode=zLevelMode(operation);detail=\`${'${mode===\'model\'?\'Modell · Stock−Model\':\'Face Target\'}'} · Ø ${'${operation.tool.diameterMm.toFixed(3)}'} mm · ${'${operation.stepDownMm.toFixed(3)}'} mm Zustellung · ${'${operation.stepoverPercent}'}% Stepover · ${'${operation.finishAllowanceMm.toFixed(3)}'} mm Aufmaß\`;`,
`else if(operation.kind==='z-level-roughing'){const mode=zLevelMode(operation),islands=mode==='face-target'?((operation.islandMode??'preserve')==='clear'?' · Inneninseln mit schruppen':' · Inneninseln stehen lassen'):'';detail=\`${'${mode===\'model\'?\'Modell · Stock−Model\':\'Face Target\'}'}${'${islands}'} · Ø ${'${operation.tool.diameterMm.toFixed(3)}'} mm · ${'${operation.stepDownMm.toFixed(3)}'} mm Zustellung · ${'${operation.stepoverPercent}'}% Stepover · ${'${operation.finishAllowanceMm.toFixed(3)}'} mm Aufmaß\`;`,
'preflight island detail');

// 7) Contract gate.
const gate='scripts/check-004z-contracts.mjs';
let g=fs.readFileSync(gate,'utf8');
const gateAnchor="requireText(zLevel,'„Stock – Model“ verwenden','stock-top planar face explains the correct Stock−Model workflow');";
const gateExtra=`${gateAnchor}\nconst faceTargetRoughing=read('src/lib/faceTargetRoughing.ts');\nconst faceTargetOperation=read('src/lib/faceTargetOperation.ts');\nrequireText(types,\"export type ZLevelIslandMode='preserve'|'clear'\",'004Z-B persists an explicit face-target island decision');\nrequireText(types,\"islandMode?:ZLevelIslandMode\",'Z-level operation stores island semantics');\nrequireText(faceTargetRoughing,'function outerBoundaryLoops','004Z-B distinguishes exterior target boundaries from nested islands');\nrequireText(faceTargetRoughing,\"const loops=islandMode==='clear'?outerLoops:allLoops\",'clear mode fills inner target loops while preserve mode keeps them');\nrequireText(faceTargetOperation,\"operation.islandMode??'preserve'\",'canonical face-target operation forwards island semantics');\nrequireText(zLevel,'004Z-B:','Prüfen reports whether inner islands were preserved or cleared');\nrequireText(app,'>Stehen lassen</button>','Bearbeiten exposes preserve-islands explicitly');\nrequireText(app,'>Mit schruppen</button>','Bearbeiten exposes clear-islands explicitly');`;
if(!g.includes(gateAnchor))throw new Error('004Z-B gate anchor missing');
g=g.replace(gateAnchor,gateExtra);
g=g.replace("console.log('004Z PASS: STEP contours use face-first selection, opaque visibility-aware STEP picking, OCCT-trimmed geometry, automatic 004P rest-stock start Z with model-profile depth semantics, edge-second refinement, and one canonical Bearbeiten/Prüfen/NC path.');","console.log('004Z PASS: STEP contours keep one canonical Bearbeiten/Prüfen/NC path; 004Z-B adds explicit preserve/clear island semantics for Face-Target roughing.');");
fs.writeFileSync(gate,g);

console.log('004Z-B island semantics applied.');
