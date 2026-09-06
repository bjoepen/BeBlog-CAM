import type { StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, OperationsProject } from './types';
import type { FixtureVolume } from './fixtureCollision';
import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';
import type { SpindleHeadGeometry } from './spindleHeadCollision';

export const CAM_PROJECT_FORMAT='beblog-cam-project' as const;
export const CAM_PROJECT_VERSION=1 as const;

export type CamProjectV1={
  format:typeof CAM_PROJECT_FORMAT;
  version:typeof CAM_PROJECT_VERSION;
  source:{path:string;fileName:string};
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
  if(!object(project.setup))throw new Error('Projektdatei enthält kein gültiges Setup.');
  if(!object(project.operationsProject)||!Array.isArray(project.operationsProject.operations))throw new Error('Projektdatei enthält kein gültiges Operationsprojekt.');
  return clone(project);
}

export function migrateCamProject(value:unknown):CamProject{
  if(typeof value==='string')return parseCamProject(value);
  return parseCamProject(JSON.stringify(value));
}
