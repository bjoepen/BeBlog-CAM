import type { CamOperation, OperationKind, OperationsProject } from './types';
import { defaultCarveOperation, defaultContourOperation, defaultPocketOperation } from './types';

export function cloneOperation<T extends CamOperation>(operation:T):T {
  return {...operation,tool:{...operation.tool},...(operation.kind==='carve'?{curveIds:[...operation.curveIds]}:{})} as T;
}

export function createOperation(kind:OperationKind,index:number):CamOperation {
  const serial=Math.max(1,index);
  if(kind==='contour') return {...defaultContourOperation,id:`op-contour-${serial}`,name:`Kontur ${serial}`,tool:{...defaultContourOperation.tool}};
  if(kind==='pocket') return {...defaultPocketOperation,id:`op-pocket-${serial}`,name:`Tasche ${serial}`,tool:{...defaultPocketOperation.tool}};
  return {...defaultCarveOperation,id:`op-carve-${serial}`,name:`Carve ${serial}`,curveIds:[],tool:{...defaultCarveOperation.tool}};
}

export function activeOperation(project:OperationsProject):CamOperation|null {
  return project.operations.find(op=>op.id===project.activeOperationId)??project.operations[0]??null;
}

export function addOperation(project:OperationsProject,kind:OperationKind):OperationsProject {
  let serial=project.operations.length+1,id='';
  do{id=`op-${kind}-${serial++}`;}while(project.operations.some(op=>op.id===id));
  const op=createOperation(kind,serial-1);
  return {operations:[...project.operations,op],activeOperationId:op.id};
}

export function replaceOperation(project:OperationsProject,next:CamOperation):OperationsProject {
  return {...project,operations:project.operations.map(op=>op.id===next.id?cloneOperation(next):op)};
}

export function selectOperation(project:OperationsProject,id:string):OperationsProject {
  return project.operations.some(op=>op.id===id)?{...project,activeOperationId:id}:project;
}

export function removeOperation(project:OperationsProject,id:string):OperationsProject {
  const index=project.operations.findIndex(op=>op.id===id);
  if(index<0)return project;
  const operations=project.operations.filter(op=>op.id!==id);
  if(project.activeOperationId!==id)return {...project,operations};
  const fallback=operations[Math.min(index,operations.length-1)]??null;
  return {operations,activeOperationId:fallback?.id??null};
}

export function operationSummary(operation:CamOperation):string {
  const tool=`Ø ${operation.tool.diameterMm.toLocaleString('de-DE',{maximumFractionDigits:3})} mm`;
  if(operation.kind==='carve'){
    const source=operation.layerName??'Einzelauswahl';
    return `${source} · ${operation.curveIds.length} Linie${operation.curveIds.length===1?'':'n'} · ${tool}`;
  }
  if(operation.kind==='contour')return `${operation.contourId===null?'Keine Kontur':`Kontur ${operation.contourId+1}`} · ${operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie'} · ${tool}`;
  return `${operation.contourId===null?'Keine Kontur':`Kontur ${operation.contourId+1}`} · ${operation.stepoverPercent}% Zustellung · ${tool}`;
}
