import type { CanonicalSpatialSegment, CanonicalToolpath } from './canonicalToolpath';
import { buildPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { buildDxfRegionPocket } from './dxfRegionPocket';
import { applyPocketRestMachining } from './pocketRestMachining';
import { applyPocketStockAwareRoughing } from './pocketStockAwareRoughing';
import { buildStepPocketOperationState } from './stepPocketOperation';
import { buildStepRegionPocket } from './stepRegionPocket';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type PocketOperationState={ok:boolean;toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];targetDepthMm:number|null};
type PocketBuildArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem};
type BasePocketState={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];targetDepthMm:number|null};
const EPS=1e-6;
const targetKey=(summary:ImportSummary,operation:PocketOperation)=>summary.kind==='step'?operation.stepFaceId==null?null:`step-face:${operation.stepFaceId}`:operation.contourId==null?null:`dxf-contour:${operation.contourId}`;

function buildBasePocket(args:PocketBuildArgs,operation:PocketOperation):BasePocketState{
  const {summary,stock,stockMode,placement,orientation,wcs}=args;
  if(summary.kind==='step'){
    if(operation.strategy==='raster'){
      const state=buildStepPocketOperationState({summary,stock,stockMode,placement,orientation,wcs,operation});
      return{toolpath:state.toolpath,errors:[...state.errors],warnings:[...state.warnings],targetDepthMm:state.targetDepthMm};
    }
    const geometryState=buildStepPocketOperationState({summary,stock,stockMode,placement,orientation,wcs,operation:{...operation,strategy:'raster',entry:'plunge'}});
    if(!geometryState.selected||geometryState.targetDepthMm==null||geometryState.errors.length)return{toolpath:null,errors:[...geometryState.errors],warnings:[...geometryState.warnings],targetDepthMm:geometryState.targetDepthMm};
    const strategy=operation.strategy==='auto'?(geometryState.selected.islands.length?'parallel':'concentric'):operation.strategy;
    const region=buildStepRegionPocket({summary,stock,placement,orientation,wcs,operation,candidate:geometryState.selected,targetDepthMm:geometryState.targetDepthMm,strategy});
    return{toolpath:region.toolpath,errors:[...region.errors],warnings:[...geometryState.warnings,...region.warnings],targetDepthMm:geometryState.targetDepthMm};
  }
  if(operation.strategy==='concentric'||operation.strategy==='parallel'){
    const region=buildDxfRegionPocket({summary,stock,stockMode,placement,orientation,wcs,operation,strategy:operation.strategy});
    return{toolpath:region.toolpath,errors:[...region.errors],warnings:[...region.warnings],targetDepthMm:operation.totalDepthMm};
  }
  const toolpath=buildPocketCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
  return{toolpath,errors:toolpath?[]:['DXF-Taschenwerkzeugweg konnte nicht aufgebaut werden.'],warnings:[],targetDepthMm:operation.totalDepthMm};
}

function adjustEntryDepth(entry:CanonicalSpatialSegment[]|undefined,startZ:number,endZ:number):CanonicalSpatialSegment[]|undefined{if(!entry?.length)return undefined;return entry.map((segment,index)=>{const a=index/entry.length,b=(index+1)/entry.length,z0=startZ+(endZ-startZ)*a,z1=startZ+(endZ-startZ)*b;return{...segment,start:{...segment.start,z:z0},end:{...segment.end,z:z1}};});}
function limitPocketDepth(toolpath:CanonicalToolpath,depthMm:number):CanonicalToolpath{const targetZ=-depthMm,kept=toolpath.runs.filter(run=>run.z>=targetZ-EPS);if(kept.some(run=>Math.abs(run.z-targetZ)<=EPS))return{...toolpath,runs:kept};const deeper=toolpath.runs.filter(run=>run.z<targetZ-EPS);if(!deeper.length)return{...toolpath,runs:kept};const nearestZ=Math.max(...deeper.map(run=>run.z)),previousZ=kept.length?Math.min(...kept.map(run=>run.z)):0,finalRuns=deeper.filter(run=>Math.abs(run.z-nearestZ)<=EPS).map(run=>({...run,z:targetZ,entrySegments:adjustEntryDepth(run.entrySegments,previousZ,targetZ)}));return{...toolpath,runs:[...kept,...finalRuns]};}
function repeatFinishRuns(toolpath:CanonicalToolpath,count:number){return Array.from({length:count},()=>toolpath.runs.map(run=>({...run,points:[...run.points],segments:run.segments?[...run.segments]:undefined,entrySegments:run.entrySegments?[...run.entrySegments]:undefined}))).flat();}

export function buildPocketOperationState(args:PocketBuildArgs&{operation:PocketOperation;previousToolpaths?:CanonicalToolpath[]}):PocketOperationState{
  const {summary,operation}=args,errors:string[]=[],warnings:string[]=[];
  const radialAllowance=Math.max(0,Number(operation.radialAllowanceMm??0)),axialAllowance=Math.max(0,Number(operation.axialAllowanceMm??0)),finishEnabled=operation.finishPassEnabled??false,finishCount=Math.max(1,Math.floor(operation.finishPassCount??1));
  const nominalOperation:PocketOperation={...operation,radialAllowanceMm:0,axialAllowanceMm:0,finishPassEnabled:false,finishPassCount:1};
  const nominal=buildBasePocket(args,nominalOperation);errors.push(...nominal.errors);warnings.push(...nominal.warnings);const targetDepthMm=nominal.targetDepthMm;
  if(!nominal.toolpath||targetDepthMm==null||errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};
  if(axialAllowance>=targetDepthMm-EPS&&axialAllowance>0)errors.push(`Axiales Taschen-Aufmaß muss kleiner als die Zieltiefe ${targetDepthMm.toFixed(3)} mm sein.`);if(errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};
  const roughDepth=Math.max(EPS,targetDepthMm-axialAllowance),roughToolDiameter=operation.tool.diameterMm+2*radialAllowance;
  const roughOperation:PocketOperation={...operation,tool:{...operation.tool,diameterMm:roughToolDiameter},totalDepthMm:summary.kind==='dxf'?roughDepth:operation.totalDepthMm,radialAllowanceMm:0,axialAllowanceMm:0,finishPassEnabled:false,finishPassCount:1};
  const rough=radialAllowance>EPS||axialAllowance>EPS?buildBasePocket(args,roughOperation):nominal;errors.push(...rough.errors);warnings.push(...rough.warnings);let toolpath=rough.toolpath;
  if(!toolpath||errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};if(summary.kind==='step'&&axialAllowance>EPS)toolpath=limitPocketDepth(toolpath,roughDepth);toolpath={...toolpath,tool:{diameterMm:operation.tool.diameterMm}};
  if(radialAllowance>EPS||axialAllowance>EPS)warnings.push(`Schrupp-Aufmaß aktiv: radial ${radialAllowance.toFixed(3)} mm · axial ${axialAllowance.toFixed(3)} mm.`);
  const key=targetKey(summary,operation);toolpath={...toolpath,sourceOperationId:operation.id,targetKey:key??undefined};
  if(operation.stockAwareRoughingEnabled&&operation.restMachiningEnabled)errors.push('Stock-aware Roughing und Restmaterial dürfen nicht gleichzeitig aktiv sein.');
  if(operation.stockAwareRoughingEnabled&&!errors.length){const adaptive=applyPocketStockAwareRoughing({toolpath,toolDiameterMm:operation.tool.diameterMm,maxRadialEngagementPercent:operation.maxRadialEngagementPercent??35});errors.push(...adaptive.errors);warnings.push(...adaptive.warnings);toolpath=adaptive.toolpath;}
  if(operation.restMachiningEnabled&&!errors.length){if(!operation.restFromOperationId)errors.push('Restmaterial benötigt eine explizite vorherige Taschenbearbeitung als Quelle.');const previous=(args.previousToolpaths??[]).find(candidate=>candidate.sourceOperationId===operation.restFromOperationId);if(operation.restFromOperationId&&!previous)errors.push('Die gewählte Restmaterialquelle ist im vorherigen kanonischen Jobpfad nicht verfügbar.');else if(previous){if(previous.operationKind!=='pocket')errors.push('Restmaterialquelle muss eine Taschenbearbeitung sein.');if(key&&previous.targetKey!==key)errors.push('Restmaterialquelle und Folgeoperation müssen dasselbe Taschenziel verwenden.');if(previous.tool.diameterMm<=operation.tool.diameterMm)errors.push('Restmaterial benötigt ein kleineres Folgewerkzeug als die vorherige Taschenbearbeitung.');if(!errors.length){const rest=applyPocketRestMachining({current:toolpath,previous,currentToolDiameterMm:operation.tool.diameterMm,previousToolDiameterMm:previous.tool.diameterMm});errors.push(...rest.errors);warnings.push(...rest.warnings);toolpath=rest.toolpath;}}}
  if(!toolpath||errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};
  if(finishEnabled){const finishOperation:PocketOperation={...nominalOperation,entry:'plunge',stepDownMm:targetDepthMm,totalDepthMm:targetDepthMm},finish=buildBasePocket(args,finishOperation);errors.push(...finish.errors);warnings.push(...finish.warnings);if(!finish.toolpath||errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};const finishRuns=repeatFinishRuns(finish.toolpath,finishCount);toolpath={...toolpath,runs:[...toolpath.runs,...finishRuns],sourceOperationId:operation.id,targetKey:key??undefined};warnings.push(`Schlichten aktiv: ${finishCount} nominale Taschen-Enddurchgang${finishCount===1?'':'e'} auf Z ${(-targetDepthMm).toFixed(3)} mm.`);}
  return{ok:true,toolpath,errors:[],warnings,targetDepthMm};
}
