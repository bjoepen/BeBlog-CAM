import type { StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, OperationsProject } from './types';
import type { FixtureVolume } from './fixtureCollision';
import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';
import type { SpindleHeadGeometry } from './spindleHeadCollision';

export const CAM_PROJECT_FORMAT='beblog-cam-project' as const;
export const CAM_PROJECT_VERSION=2 as const;

type CamProjectSetup={
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

export type CamProjectV1={
  format:typeof CAM_PROJECT_FORMAT;
  version:1;
  source:{path:string;fileName:string};
  setup:CamProjectSetup;
  operationsProject:OperationsProject;
};

export type CamProjectV2={
  format:typeof CAM_PROJECT_FORMAT;
  version:2;
  source:{path:string;fileName:string};
  setup:CamProjectSetup;
  operationsProject:OperationsProject;
};

export type CamProject=CamProjectV1|CamProjectV2;

const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);

type CreateProjectArgs={sourcePath:string;sourceFileName:string;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;fixtures:FixtureVolume[];machineEnvelopeEnabled:boolean;machineEnvelope:MachineEnvelope;machineWcsOrigin:MachineWcsOrigin;spindleHeadEnabled:boolean;spindleHead:SpindleHeadGeometry;operationsProject:OperationsProject};

function setupFrom(args:CreateProjectArgs):CamProjectSetup{
  return{stock:clone(args.stock),stockMode:args.stockMode,placement:clone(args.placement),orientation:clone(args.orientation),wcs:clone(args.wcs),fixtures:clone(args.fixtures),machineEnvelopeEnabled:args.machineEnvelopeEnabled,machineEnvelope:clone(args.machineEnvelope),machineWcsOrigin:clone(args.machineWcsOrigin),spindleHeadEnabled:args.spindleHeadEnabled,spindleHead:clone(args.spindleHead)};
}

/** Kept for compatibility with callers/tests that still create a legacy fixture explicitly. */
export function createCamProjectV1(args:CreateProjectArgs):CamProjectV1{
  return{format:CAM_PROJECT_FORMAT,version:1,source:{path:args.sourcePath,fileName:args.sourceFileName},setup:setupFrom(args),operationsProject:clone(args.operationsProject)};
}

export function createCamProjectV2(args:CreateProjectArgs):CamProjectV2{
  return{format:CAM_PROJECT_FORMAT,version:2,source:{path:args.sourcePath,fileName:args.sourceFileName},setup:setupFrom(args),operationsProject:clone(args.operationsProject)};
}

export function serializeCamProject(project:CamProject):string{return JSON.stringify(project,null,2)+'\n';}

function validateCommon(project:CamProject){
  if(!object(project.source)||typeof project.source.path!=='string'||!project.source.path.trim())throw new Error('Projektdatei enthält keine gültige Quelldatei-Referenz.');
  if(!object(project.setup))throw new Error('Projektdatei enthält kein gültiges Setup.');
  if(!object(project.operationsProject)||!Array.isArray(project.operationsProject.operations))throw new Error('Projektdatei enthält kein gültiges Operationsprojekt.');
}

export function parseCamProject(text:string):CamProject{
  let value:unknown;
  try{value=JSON.parse(text);}catch(error){throw new Error(`Projektdatei ist kein gültiges JSON: ${String(error)}`);}
  if(!object(value))throw new Error('Projektdatei besitzt kein gültiges Objektformat.');
  if(value.format!==CAM_PROJECT_FORMAT)throw new Error('Datei ist kein BeBlog-CAM-Projekt.');
  if(typeof value.version!=='number')throw new Error('Projektdatei enthält keine Formatversion.');
  if(value.version>CAM_PROJECT_VERSION)throw new Error(`Projektversion ${value.version} ist neuer als diese BeBlog-CAM-Version unterstützt.`);
  if(value.version<1)throw new Error(`Projektversion ${value.version} wird nicht unterstützt.`);
  if(value.version!==1&&value.version!==2)throw new Error(`Projektversion ${value.version} wird nicht unterstützt.`);
  const project=value as unknown as CamProject;
  validateCommon(project);
  return clone(project);
}

export function migrateCamProject(value:unknown):CamProjectV2{
  const project=typeof value==='string'?parseCamProject(value):parseCamProject(JSON.stringify(value));
  if(project.version===2)return clone(project);
  return{...clone(project),version:2};
}
