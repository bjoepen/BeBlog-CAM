import type { CanonicalToolpath } from './canonicalToolpath';
import { buildDxfContourCanonicalState } from './gcode';
import { buildPocketOperationState } from './pocketOperationState';
import { dxfMultiTargetKey, normalizeDxfTargetIds } from './dxfMultiTargetSelection';
import type { ContourOperation, ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

type CommonArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem};
export type DxfMultiTargetState={ok:boolean;toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];targetDepthMm:number|null};

function aggregate(operationId:string,ids:number[],toolpaths:CanonicalToolpath[],warnings:string[]):CanonicalToolpath|null{
  if(!toolpaths.length)return null;
  if(toolpaths.length===1)return toolpaths[0];
  const first=toolpaths[0];
  if(toolpaths.some(path=>path.operationKind!==first.operationKind||Math.abs(path.tool.diameterMm-first.tool.diameterMm)>1e-9))return null;
  const strategies=[...new Set(toolpaths.map(path=>path.strategy))];
  if(strategies.length>1)warnings.push(`Mehrfachauswahl verwendet ${strategies.length} intern aufgelöste Strategien; die kanonischen Runs bleiben zielweise unverändert.`);
  return{
    ...first,
    runs:toolpaths.flatMap(path=>path.runs),
    motions:undefined,
    sourceOperationId:operationId,
    targetKey:dxfMultiTargetKey(ids)
  };
}

export function buildDxfMultiTargetContourState(args:CommonArgs&{operation:ContourOperation}):DxfMultiTargetState{
  const {operation}=args;
  if(operation.topology!=='closed'){
    const state=buildDxfContourCanonicalState(args);
    return{ok:state.ok,toolpath:state.toolpath,errors:[...state.errors],warnings:[...state.warnings],targetDepthMm:operation.totalDepthMm};
  }
  const ids=normalizeDxfTargetIds(operation);
  if(!ids.length)return{ok:false,toolpath:null,errors:['Keine geschlossene DXF-Kontur gewählt.'],warnings:[],targetDepthMm:operation.totalDepthMm};
  if(ids.length===1){
    const single={...operation,contourId:ids[0],contourIds:[ids[0]]};
    const state=buildDxfContourCanonicalState({...args,operation:single});
    return{ok:state.ok,toolpath:state.toolpath,errors:[...state.errors],warnings:[...state.warnings],targetDepthMm:operation.totalDepthMm};
  }
  if((operation.excludedSegmentIds??[]).length)return{ok:false,toolpath:null,errors:['Aufgebrochene Konturen sind mit DXF-Mehrfachauswahl in Build 006B nicht freigegeben.'],warnings:[],targetDepthMm:operation.totalDepthMm};
  const paths:CanonicalToolpath[]=[],errors:string[]=[],warnings:string[]=[];
  for(const id of ids){
    const single={...operation,contourId:id,contourIds:[id],excludedSegmentIds:[]};
    const state=buildDxfContourCanonicalState({...args,operation:single});
    errors.push(...state.errors.map(message=>`Kontur ${id+1}: ${message}`));
    warnings.push(...state.warnings.map(message=>`Kontur ${id+1}: ${message}`));
    if(state.toolpath)paths.push(state.toolpath);
  }
  if(errors.length||paths.length!==ids.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm:operation.totalDepthMm};
  const toolpath=aggregate(operation.id,ids,paths,warnings);
  if(!toolpath)return{ok:false,toolpath:null,errors:['DXF-Mehrfachauswahl konnte nicht zu einem kanonischen Konturpfad zusammengeführt werden.'],warnings,targetDepthMm:operation.totalDepthMm};
  return{ok:true,toolpath,errors:[],warnings,targetDepthMm:operation.totalDepthMm};
}

export function buildDxfMultiTargetPocketState(args:CommonArgs&{operation:PocketOperation;previousToolpaths?:CanonicalToolpath[]}):DxfMultiTargetState{
  const {operation}=args,ids=normalizeDxfTargetIds(operation);
  if(!ids.length)return{ok:false,toolpath:null,errors:['Keine geschlossene DXF-Taschenkontur gewählt.'],warnings:[],targetDepthMm:operation.totalDepthMm};
  if(ids.length===1){
    const single={...operation,contourId:ids[0],contourIds:[ids[0]]};
    return buildPocketOperationState({...args,operation:single});
  }
  if(operation.restMachiningEnabled)return{ok:false,toolpath:null,errors:['Restmaterial mit DXF-Mehrfachauswahl ist in Build 006B noch nicht freigegeben.'],warnings:[],targetDepthMm:operation.totalDepthMm};
  const paths:CanonicalToolpath[]=[],errors:string[]=[],warnings:string[]=[];
  for(const id of ids){
    const single={...operation,contourId:id,contourIds:[id],restMachiningEnabled:false,restFromOperationId:null};
    const state=buildPocketOperationState({...args,operation:single});
    errors.push(...state.errors.map(message=>`Tasche ${id+1}: ${message}`));
    warnings.push(...state.warnings.map(message=>`Tasche ${id+1}: ${message}`));
    if(state.toolpath)paths.push(state.toolpath);
  }
  if(errors.length||paths.length!==ids.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm:operation.totalDepthMm};
  const toolpath=aggregate(operation.id,ids,paths,warnings);
  if(!toolpath)return{ok:false,toolpath:null,errors:['DXF-Mehrfachauswahl konnte nicht zu einem kanonischen Taschenpfad zusammengeführt werden.'],warnings,targetDepthMm:operation.totalDepthMm};
  return{ok:true,toolpath,errors:[],warnings,targetDepthMm:operation.totalDepthMm};
}
