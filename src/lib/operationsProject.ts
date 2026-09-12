import { writable } from 'svelte/store';
import type { CamOperation, ContourOperation, OperationKind, OperationsProject, PocketOperation } from './types';
import { normalizeDxfTargetIds } from './dxfMultiTargetSelection';
import { defaultFacingOperation, defaultCarveOperation, defaultSurfaceCarveOperation, defaultContourOperation, defaultPocketOperation, defaultDrillOperation, defaultZLevelRoughingOperation, defaultSurfaceFinishingOperation, defaultOperationsProject } from './types';

export const operationsProjectStore=writable<OperationsProject>({
  operations:defaultOperationsProject.operations.map(op=>cloneOperation(op)),
  activeOperationId:defaultOperationsProject.activeOperationId
});

function sync(project:OperationsProject){operationsProjectStore.set({operations:project.operations.map(cloneOperation),activeOperationId:project.activeOperationId});return project;}

export function cloneOperation<T extends CamOperation>(operation:T):T {
  return {...operation,tool:{...operation.tool},...((operation.kind==='carve'||operation.kind==='drill')?{curveIds:[...operation.curveIds]}:{}),...(operation.kind==='drill'?{stepHoleFeatureIds:[...(operation.stepHoleFeatureIds??[])]}:{}),...(operation.kind==='surface-carve'?{geometrySource:operation.geometrySource?{...operation.geometrySource}:null}:{}),...((operation.kind==='z-level-roughing'||operation.kind==='surface-finishing')?{faceIds:[...operation.faceIds]}:{}),...((operation.kind==='contour'||operation.kind==='pocket')?{contourIds:[...normalizeDxfTargetIds(operation)]}:{}),...(operation.kind==='contour'?{excludedSegmentIds:[...(operation.excludedSegmentIds??[])]}:{})} as T;
}

function operationName(kind:OperationKind,serial:number){
  if(kind==='facing')return`Planen ${serial}`;
  if(kind==='contour')return`Kontur ${serial}`;
  if(kind==='pocket')return`Tasche ${serial}`;
  if(kind==='carve')return`Carve ${serial}`;
  if(kind==='surface-carve')return`Surface Carve ${serial}`;
  if(kind==='drill')return`Bohren ${serial}`;
  if(kind==='z-level-roughing')return`Z-Level Schruppen ${serial}`;
  return`3D Schlichten ${serial}`;
}

export function createOperation(kind:OperationKind,index:number):CamOperation {
  const serial=Math.max(1,index);
  if(kind==='facing') return {...defaultFacingOperation,id:`op-facing-${serial}`,name:operationName(kind,serial),tool:{...defaultFacingOperation.tool}};
  if(kind==='contour') return {...defaultContourOperation,id:`op-contour-${serial}`,name:operationName(kind,serial),contourIds:[],excludedSegmentIds:[],tool:{...defaultContourOperation.tool}};
  if(kind==='pocket') return {...defaultPocketOperation,id:`op-pocket-${serial}`,name:operationName(kind,serial),contourIds:[],tool:{...defaultPocketOperation.tool}};
  if(kind==='carve') return {...defaultCarveOperation,id:`op-carve-${serial}`,name:operationName(kind,serial),curveIds:[],tool:{...defaultCarveOperation.tool}};
  if(kind==='surface-carve') return {...defaultSurfaceCarveOperation,id:`op-surface-carve-${serial}`,name:operationName(kind,serial),geometrySource:null,tool:{...defaultSurfaceCarveOperation.tool}};
  if(kind==='drill') return {...defaultDrillOperation,id:`op-drill-${serial}`,name:operationName(kind,serial),curveIds:[],stepHoleFeatureIds:[],tool:{...defaultDrillOperation.tool}};
  if(kind==='z-level-roughing') return {...defaultZLevelRoughingOperation,id:`op-z-level-roughing-${serial}`,name:operationName(kind,serial),faceIds:[],tool:{...defaultZLevelRoughingOperation.tool}};
  return {...defaultSurfaceFinishingOperation,id:`op-surface-finishing-${serial}`,name:operationName(kind,serial),faceIds:[],tool:{...defaultSurfaceFinishingOperation.tool}};
}

export function activeOperation(project:OperationsProject):CamOperation|null {
  sync(project);
  return project.operations.find(op=>op.id===project.activeOperationId)??project.operations[0]??null;
}

export function addOperation(project:OperationsProject,kind:OperationKind):OperationsProject {
  let serial=project.operations.length+1,id='';
  do{id=`op-${kind}-${serial++}`;}while(project.operations.some(op=>op.id===id));
  const op=createOperation(kind,serial-1);
  return sync({operations:[...project.operations,op],activeOperationId:op.id});
}

export function replaceOperation(project:OperationsProject,next:CamOperation):OperationsProject {
  return sync({...project,operations:project.operations.map((op,index)=>{
    if(op.id!==next.id)return op;
    if(op.kind===next.kind)return cloneOperation(next);
    const serial=Number(op.name.match(/(\d+)\s*$/)?.[1]??index+1);
    return cloneOperation({...next,name:operationName(next.kind,Number.isFinite(serial)&&serial>0?serial:index+1)} as CamOperation);
  })});
}

export function selectOperation(project:OperationsProject,id:string):OperationsProject {
  return sync(project.operations.some(op=>op.id===id)?{...project,activeOperationId:id}:project);
}

export function removeOperation(project:OperationsProject,id:string):OperationsProject {
  const index=project.operations.findIndex(op=>op.id===id);
  if(index<0)return sync(project);
  const operations=project.operations.filter(op=>op.id!==id);
  if(project.activeOperationId!==id)return sync({...project,operations});
  const fallback=operations[Math.min(index,operations.length-1)]??null;
  return sync({operations,activeOperationId:fallback?.id??null});
}

export function dxfTargetIds(operation:ContourOperation|PocketOperation):number[]{return normalizeDxfTargetIds(operation);}

export function operationSummary(operation:CamOperation):string {
  const tool=`Ø ${operation.tool.diameterMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm`;
  if(operation.kind==='facing')return `${operation.direction==='x'?'X-Raster':'Y-Raster'} · ${operation.stepoverPercent}% Zustellung · ${operation.totalDepthMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm Abtrag · ${tool}`;
  if(operation.kind==='carve'){
    const source=operation.layerName??'Einzelauswahl';
    const side=operation.side==='left'?'Links':operation.side==='right'?'Rechts':'Auf Linie';
    return `${source} · ${operation.curveIds.length} Linie${operation.curveIds.length===1?'':'n'} · ${side} · ${tool}`;
  }
  if(operation.kind==='surface-carve'){
    const source=operation.geometrySource?.fileName??'Keine 2D-Geometrie';
    const face=operation.faceId===null?'Keine Fläche':`Face ${operation.faceId}`;
    return `${source} · ${face} · ${operation.totalDepthMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm tief · ${tool}`;
  }
  if(operation.kind==='drill'){
    const stepCount=operation.stepHoleFeatureIds?.length??0;
    const count=stepCount||operation.curveIds.length;
    const source=stepCount?'STEP-Auswahl':operation.layerName??'Einzelauswahl';
    const method=operation.method==='helical-mill'?'Helixfräsen':'Bohren';
    const depth=(operation.depthMode??'manual')==='stock-bottom'?`Durch Rohling + ${(operation.overcutMm??0).toLocaleString('de-DE',{maximumFractionDigits:3})} mm`:`${operation.totalDepthMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm tief`;
    return `${method} · ${depth} · ${source} · ${count} Bohrung${count===1?'':'en'} · ${tool}`;
  }
  if(operation.kind==='surface-finishing'){
    return `${operation.direction==='x'?'Parallel X':'Parallel Y'} · ${operation.stepoverPercent}% Stepover · ${operation.faceIds.length} Fläche${operation.faceIds.length===1?'':'n'} · ${tool}`;
  }
  if(operation.kind==='z-level-roughing'){
    const source=(operation.roughingMode??'face-target')==='model'?'Modell':'Face Target';
    const islands=(operation.islandMode??'preserve')==='clear'?'Inseln mit schruppen':'Inseln stehen lassen';
    return `${source} · ${islands} · ${operation.stepDownMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm Zustellung · ${operation.stepoverPercent}% Stepover · ${operation.finishAllowanceMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm Aufmaß · ${tool}`;
  }
  if(operation.kind==='contour'){
    const side=operation.topology==='open'?(operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie'):(operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie');
    const excluded=operation.excludedSegmentIds??[];
    const broken=operation.topology==='closed'&&excluded.length?` · ${excluded.length} Strecke${excluded.length===1?'':'n'} aus` : '';
    const targets=operation.topology==='closed'?dxfTargetIds(operation):[];const target=operation.topology==='closed'?(targets.length?`${targets.length} Kontur${targets.length===1?'':'en'}`:'Keine Kontur'):(operation.contourId===null?'Keine Kontur':`Offene ${operation.contourId+1}`);return `${target} · ${side}${broken} · ${tool}`;
  }
  const strategy=operation.strategy==='auto'?'Auto':operation.strategy==='raster'?'Raster':operation.strategy==='concentric'?'Kreis':'Konturparallel';
  const entry=operation.entry==='helix'?'Helix':operation.entry==='ramp'?'Rampe':'Senkrecht';
  const targets=dxfTargetIds(operation);return `${targets.length?`${targets.length} Taschenziel${targets.length===1?'':'e'}`:'Keine Kontur'} · ${strategy} · ${entry} · ${operation.stepoverPercent}% Zustellung · ${tool}`;
}