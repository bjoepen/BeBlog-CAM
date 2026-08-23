import { writable } from 'svelte/store';
import type { CamOperation, OperationKind, OperationsProject } from './types';
import { defaultFacingOperation, defaultCarveOperation, defaultContourOperation, defaultPocketOperation, defaultDrillOperation, defaultOperationsProject } from './types';

export const operationsProjectStore=writable<OperationsProject>({
  operations:defaultOperationsProject.operations.map(op=>cloneOperation(op)),
  activeOperationId:defaultOperationsProject.activeOperationId
});

function sync(project:OperationsProject){operationsProjectStore.set({operations:project.operations.map(cloneOperation),activeOperationId:project.activeOperationId});return project;}

export function cloneOperation<T extends CamOperation>(operation:T):T {
  return {...operation,tool:{...operation.tool},...((operation.kind==='carve'||operation.kind==='drill')?{curveIds:[...operation.curveIds]}:{}),...(operation.kind==='contour'?{excludedSegmentIds:[...(operation.excludedSegmentIds??[])]}:{})} as T;
}

export function createOperation(kind:OperationKind,index:number):CamOperation {
  const serial=Math.max(1,index);
  if(kind==='facing') return {...defaultFacingOperation,id:`op-facing-${serial}`,name:`Planen ${serial}`,tool:{...defaultFacingOperation.tool}};
  if(kind==='contour') return {...defaultContourOperation,id:`op-contour-${serial}`,name:`Kontur ${serial}`,excludedSegmentIds:[],tool:{...defaultContourOperation.tool}};
  if(kind==='pocket') return {...defaultPocketOperation,id:`op-pocket-${serial}`,name:`Tasche ${serial}`,tool:{...defaultPocketOperation.tool}};
  if(kind==='drill') return {...defaultDrillOperation,id:`op-drill-${serial}`,name:`Bohren ${serial}`,curveIds:[],tool:{...defaultDrillOperation.tool}};
  return {...defaultCarveOperation,id:`op-carve-${serial}`,name:`Carve ${serial}`,curveIds:[],tool:{...defaultCarveOperation.tool}};
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
  return sync({...project,operations:project.operations.map(op=>op.id===next.id?cloneOperation(next):op)});
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

export function operationSummary(operation:CamOperation):string {
  const tool=`Ø ${operation.tool.diameterMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm`;
  if(operation.kind==='facing')return `${operation.direction==='x'?'X-Raster':'Y-Raster'} · ${operation.stepoverPercent}% Zustellung · ${operation.totalDepthMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm Abtrag · ${tool}`;
  if(operation.kind==='carve'){
    const source=operation.layerName??'Einzelauswahl';
    const side=operation.side==='left'?'Links':operation.side==='right'?'Rechts':'Auf Linie';
    return `${source} · ${operation.curveIds.length} Linie${operation.curveIds.length===1?'':'n'} · ${side} · ${tool}`;
  }
  if(operation.kind==='drill'){
    const source=operation.layerName??'Einzelauswahl';
    const method=operation.method==='helical-mill'?'Helixfräsen':'Bohren';
    return `${method} · ${source} · ${operation.curveIds.length} Bohrung${operation.curveIds.length===1?'':'en'} · ${tool}`;
  }
  if(operation.kind==='contour'){
    const side=operation.topology==='open'?(operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie'):(operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie');
    const excluded=operation.excludedSegmentIds??[];
    const broken=operation.topology==='closed'&&excluded.length?` · ${excluded.length} Strecke${excluded.length===1?'':'n'} aus` : '';
    return `${operation.contourId===null?'Keine Kontur':`${operation.topology==='open'?'Offene':'Kontur'} ${operation.contourId+1}`} · ${side}${broken} · ${tool}`;
  }
  const strategy=operation.strategy==='auto'?'Auto':operation.strategy==='raster'?'Raster':operation.strategy==='concentric'?'Kreis':'Konturparallel';
  const entry=operation.entry==='helix'?'Helix':operation.entry==='ramp'?'Rampe':'Senkrecht';
  return `${operation.contourId===null?'Keine Kontur':`Kontur ${operation.contourId+1}`} · ${strategy} · ${entry} · ${operation.stepoverPercent}% Zustellung · ${tool}`;
}
