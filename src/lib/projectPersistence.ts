import type { StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, OperationsProject } from './types';
import type { FixtureVolume } from './fixtureCollision';
import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';
import type { SpindleHeadGeometry } from './spindleHeadCollision';

export const CAM_PROJECT_FORMAT='beblog-cam-project' as const;
export const CAM_PROJECT_VERSION=1 as const;

export type CamProjectV1={
  format:typeof CAM_PROJECT_FORMAT;
  version:typeof CAM_PROJECT_VERSION;
  source:{path:string;fileName:string;geometryIdentity?:string};
  setup:{
    stock:StockDefinition;
    stockMode:StockMode;
    placement:PartPlacement;
    orientation:PartOrientation;
    wcs:WorkCoordinateSystem;
    fixtures:FixtureVolume[];
    machineEnvelopeEnabled:boolean;
    machineEnvelope:MachineEnvelope;
    machineWcsOrigin:MachineWcsOrigin;
    spindleHeadEnabled:boolean;
    spindleHead:SpindleHeadGeometry;
  };
  operationsProject:OperationsProject;
};

export type CamProject=CamProjectV1;

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const nonEmptyString=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
const operationKinds=new Set(['facing','contour','pocket','carve','drill','z-level-roughing','surface-finishing']);

function validateOperationsProject(project:CamProjectV1):void{
  const operationsProject=project.operationsProject as unknown as Record<string,unknown>;
  const operations=operationsProject.operations as unknown[];
  if(operations.length===0)throw new Error('Projektdatei enthält keine Bearbeitung.');

  const ids=new Set<string>();
  const operationById=new Map<string,Record<string,unknown>>();
  const operationIndex=new Map<string,number>();
  for(const [index,value] of operations.entries()){
    if(!object(value))throw new Error(`Bearbeitung ${index+1} besitzt kein gültiges Objektformat.`);
    if(!nonEmptyString(value.id))throw new Error(`Bearbeitung ${index+1} enthält keine gültige ID.`);
    if(ids.has(value.id))throw new Error(`Projektdatei enthält die Bearbeitungs-ID ${value.id} mehrfach.`);
    ids.add(value.id);
    operationById.set(value.id,value);
    operationIndex.set(value.id,index);
    if(!operationKinds.has(String(value.kind)))throw new Error(`Bearbeitung ${value.id} enthält einen unbekannten Typ.`);
    if(!object(value.tool))throw new Error(`Bearbeitung ${value.id} enthält kein gültiges Werkzeug.`);
    if(!nonEmptyString(value.tool.id))throw new Error(`Werkzeug der Bearbeitung ${value.id} enthält keine gültige ID.`);
    if(!nonEmptyString(value.tool.name))throw new Error(`Werkzeug der Bearbeitung ${value.id} enthält keinen gültigen Namen.`);
    if(typeof value.tool.diameterMm!=='number'||!Number.isFinite(value.tool.diameterMm)||value.tool.diameterMm<=0)throw new Error(`Werkzeug der Bearbeitung ${value.id} enthält keinen gültigen Durchmesser.`);
  }

  const activeId=operationsProject.activeOperationId;
  if(activeId!==null&&(!nonEmptyString(activeId)||!ids.has(activeId)))throw new Error('Projektdatei verweist auf eine nicht vorhandene aktive Bearbeitung.');

  for(const value of operations){
    const operation=value as Record<string,unknown>;
    if(operation.kind==='pocket'&&operation.restMachiningEnabled===true){
      const reference=operation.restFromOperationId;
      if(!nonEmptyString(reference)||!ids.has(reference))throw new Error(`Restmaterial-Bearbeitung ${String(operation.id)} verweist auf keine vorhandene Quellbearbeitung.`);
      if(reference===operation.id)throw new Error(`Restmaterial-Bearbeitung ${String(operation.id)} darf nicht auf sich selbst verweisen.`);
      const source=operationById.get(reference)!;
      if(source.kind!=='pocket')throw new Error(`Restmaterial-Bearbeitung ${String(operation.id)} muss auf eine Taschenbearbeitung verweisen.`);
      if((operationIndex.get(reference)??-1)>=(operationIndex.get(String(operation.id))??-1))throw new Error(`Restmaterial-Bearbeitung ${String(operation.id)} muss auf eine frühere Taschenbearbeitung verweisen.`);
    }
  }
}

export function createCamProjectV1(args:{sourcePath:string;sourceFileName:string;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;fixtures:FixtureVolume[];machineEnvelopeEnabled:boolean;machineEnvelope:MachineEnvelope;machineWcsOrigin:MachineWcsOrigin;spindleHeadEnabled:boolean;spindleHead:SpindleHeadGeometry;operationsProject:OperationsProject}):CamProjectV1{
  return{
    format:CAM_PROJECT_FORMAT,
    version:CAM_PROJECT_VERSION,
    source:{path:args.sourcePath,fileName:args.sourceFileName},
    setup:{stock:clone(args.stock),stockMode:args.stockMode,placement:clone(args.placement),orientation:clone(args.orientation),wcs:clone(args.wcs),fixtures:clone(args.fixtures),machineEnvelopeEnabled:args.machineEnvelopeEnabled,machineEnvelope:clone(args.machineEnvelope),machineWcsOrigin:clone(args.machineWcsOrigin),spindleHeadEnabled:args.spindleHeadEnabled,spindleHead:clone(args.spindleHead)},
    operationsProject:clone(args.operationsProject)
  };
}

export function serializeCamProject(project:CamProject):string{return JSON.stringify(project,null,2)+'\n';}

export function parseCamProject(text:string):CamProject{
  let value:unknown;
  try{value=JSON.parse(text);}catch(error){throw new Error(`Projektdatei ist kein gültiges JSON: ${String(error)}`);}
  if(!object(value))throw new Error('Projektdatei besitzt kein gültiges Objektformat.');
  if(value.format!==CAM_PROJECT_FORMAT)throw new Error('Datei ist kein BeBlog-CAM-Projekt.');
  if(typeof value.version!=='number')throw new Error('Projektdatei enthält keine Formatversion.');
  if(value.version>CAM_PROJECT_VERSION)throw new Error(`Projektversion ${value.version} ist neuer als diese BeBlog-CAM-Version unterstützt.`);
  if(value.version<1)throw new Error(`Projektversion ${value.version} wird nicht unterstützt.`);
  const project=value as unknown as CamProjectV1;
  if(!object(project.source)||typeof project.source.path!=='string'||!project.source.path.trim())throw new Error('Projektdatei enthält keine gültige Quelldatei-Referenz.');
  if(project.source.geometryIdentity!==undefined&&(typeof project.source.geometryIdentity!=='string'||!project.source.geometryIdentity.trim()))throw new Error('Projektdatei enthält keine gültige Geometrie-Identität der Quelldatei.');
  if(!object(project.setup))throw new Error('Projektdatei enthält kein gültiges Setup.');
  if(!object(project.operationsProject)||!Array.isArray(project.operationsProject.operations))throw new Error('Projektdatei enthält kein gültiges Operationsprojekt.');
  validateOperationsProject(project);
  return clone(project);
}

export function migrateCamProject(value:unknown):CamProject{
  if(typeof value==='string')return parseCamProject(value);
  return parseCamProject(JSON.stringify(value));
}
