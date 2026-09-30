import type { StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import type { TrochoidalContourContract } from './trochoidalContourContract';

export type TrochoidalMachiningDepth={
  ok:true;mode:'manual'|'stock-bottom';targetDepthMm:number;workpieceBottomDepthMm:number|null;overcutMm:number;
}|{ok:false;errors:string[]};

export function resolveTrochoidalMachiningDepth(args:{operation:TrochoidalContourContract;stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem}):TrochoidalMachiningDepth{
  const {operation,stock,stockMode,wcs}=args,mode=operation.depthMode??'manual',errors:string[]=[];
  if(wcs.z!=='top')errors.push('Reale Wirbelfräs-Tiefe benötigt Z-Null auf der Rohlingoberseite.');
  if(mode==='manual'){
    if(!(operation.totalDepthMm>0))errors.push('Manuelle Wirbelfräs-Tiefe muss größer als 0 sein.');
    if((operation.overcutMm??0)!==0)errors.push('Überfräsen ist nur im Modus Rohlingunterseite zulässig.');
    if(operation.tool.cuttingLengthMm==null||!(operation.tool.cuttingLengthMm>0))errors.push('Wirbelfräsen benötigt eine definierte Schneidenlänge.');
    else if(operation.tool.cuttingLengthMm+1e-9<operation.totalDepthMm)errors.push(`Schneidenlänge ${operation.tool.cuttingLengthMm.toFixed(3)} mm erreicht die reale Zieltiefe ${operation.totalDepthMm.toFixed(3)} mm nicht.`);
    return errors.length?{ok:false,errors}:{ok:true,mode,targetDepthMm:operation.totalDepthMm,workpieceBottomDepthMm:stockMode==='none'?null:stock.thickness,overcutMm:0};
  }
  if(stockMode==='none')errors.push('Durchfräsen bis Rohlingunterseite benötigt einen definierten Rohling.');
  if(!(stock.thickness>0))errors.push('Rohlingdicke muss größer als 0 sein.');
  const overcut=operation.overcutMm??0;
  if(overcut<0)errors.push('Überfräsen darf nicht negativ sein.');
  const target=stock.thickness+overcut;
  if(operation.tool.cuttingLengthMm==null||!(operation.tool.cuttingLengthMm>0))errors.push('Durchfräsen benötigt eine definierte Schneidenlänge.');
  else if(operation.tool.cuttingLengthMm+1e-9<target)errors.push(`Schneidenlänge ${operation.tool.cuttingLengthMm.toFixed(3)} mm erreicht die reale Zieltiefe ${target.toFixed(3)} mm nicht.`);
  return errors.length?{ok:false,errors}:{ok:true,mode,targetDepthMm:target,workpieceBottomDepthMm:stock.thickness,overcutMm:overcut};
}
