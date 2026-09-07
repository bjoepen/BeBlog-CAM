import type { CanonicalToolpath } from './canonicalToolpath';
import { buildPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { applyPocketRestMachining } from './pocketRestMachining';
import { applyPocketStockAwareRoughing } from './pocketStockAwareRoughing';
import { buildStepPocketOperationState } from './stepPocketOperation';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type PocketOperationState={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  targetDepthMm:number|null;
};

const targetKey=(summary:ImportSummary,operation:PocketOperation)=>summary.kind==='step'
  ?operation.stepFaceId==null?null:`step-face:${operation.stepFaceId}`
  :operation.contourId==null?null:`dxf-contour:${operation.contourId}`;

export function buildPocketOperationState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  stockMode:StockMode;
  placement:PartPlacement;
  orientation:PartOrientation;
  wcs:WorkCoordinateSystem;
  operation:PocketOperation;
  previousToolpaths?:CanonicalToolpath[];
}):PocketOperationState{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  let toolpath:CanonicalToolpath|null=null,targetDepthMm:number|null=null;

  if(summary.kind==='step'){
    const state=buildStepPocketOperationState({summary,stock,stockMode,placement,orientation,wcs,operation});
    errors.push(...state.errors);warnings.push(...state.warnings);toolpath=state.toolpath;targetDepthMm=state.targetDepthMm;
  }else{
    toolpath=buildPocketCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
    targetDepthMm=operation.totalDepthMm;
    if(!toolpath)errors.push('DXF-Taschenwerkzeugweg konnte nicht aufgebaut werden.');
  }
  if(!toolpath||errors.length)return{ok:false,toolpath:null,errors,warnings,targetDepthMm};

  const key=targetKey(summary,operation);
  toolpath={...toolpath,sourceOperationId:operation.id,targetKey:key??undefined};

  if(operation.stockAwareRoughingEnabled&&operation.restMachiningEnabled){
    errors.push('Stock-aware Roughing und Restmaterial dürfen nicht gleichzeitig aktiv sein.');
  }
  if(operation.stockAwareRoughingEnabled&&!errors.length){
    const adaptive=applyPocketStockAwareRoughing({
      toolpath,
      toolDiameterMm:operation.tool.diameterMm,
      maxRadialEngagementPercent:operation.maxRadialEngagementPercent??35,
    });
    errors.push(...adaptive.errors);warnings.push(...adaptive.warnings);toolpath=adaptive.toolpath;
  }
  if(operation.restMachiningEnabled&&!errors.length){
    if(!operation.restFromOperationId)errors.push('Restmaterial benötigt eine explizite vorherige Taschenbearbeitung als Quelle.');
    const previous=(args.previousToolpaths??[]).find(candidate=>candidate.sourceOperationId===operation.restFromOperationId);
    if(operation.restFromOperationId&&!previous)errors.push('Die gewählte Restmaterialquelle ist im vorherigen kanonischen Jobpfad nicht verfügbar.');
    else if(previous){
      if(previous.operationKind!=='pocket')errors.push('Restmaterialquelle muss eine Taschenbearbeitung sein.');
      if(key&&previous.targetKey!==key)errors.push('Restmaterialquelle und Folgeoperation müssen dasselbe Taschenziel verwenden.');
      if(previous.tool.diameterMm<=operation.tool.diameterMm)errors.push('Restmaterial benötigt ein kleineres Folgewerkzeug als die vorherige Taschenbearbeitung.');
      if(!errors.length){
        const rest=applyPocketRestMachining({
          current:toolpath!,
          previous,
          currentToolDiameterMm:operation.tool.diameterMm,
          previousToolDiameterMm:previous.tool.diameterMm,
        });
        errors.push(...rest.errors);warnings.push(...rest.warnings);toolpath=rest.toolpath;
      }
    }
  }

  return{ok:errors.length===0&&toolpath!==null,toolpath:errors.length?null:toolpath,errors,warnings,targetDepthMm};
}
