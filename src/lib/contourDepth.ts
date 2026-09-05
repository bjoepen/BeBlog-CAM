import type { ContourOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type ContourDepthResolution={ok:boolean;depthMm:number;bottomZMm:number;errors:string[];warnings:string[];mode:'manual'|'stock-bottom';overcutMm:number};

export function resolveContourDepth(args:{operation:ContourOperation;stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem}):ContourDepthResolution{
  const {operation,stock,stockMode,wcs}=args;
  const mode=operation.depthMode??'manual';
  const rawOvercut=operation.overcutMm??0;
  const overcut=Number.isFinite(rawOvercut)?Math.max(0,rawOvercut):0;
  const errors:string[]=[],warnings:string[]=[];
  if(mode==='manual'){
    if(!(operation.totalDepthMm>0))errors.push('Gesamttiefe muss größer als 0 sein.');
    return{ok:errors.length===0,depthMm:operation.totalDepthMm,bottomZMm:-operation.totalDepthMm,errors,warnings,mode,overcutMm:0};
  }
  if(stockMode==='none')errors.push('Durchfräsen bis Rohlingunterseite benötigt einen definierten Rohling.');
  if(wcs.z!=='top')errors.push('Rohlingunterseite + Overcut ist aktuell nur mit Z-Null auf Rohlingoberseite freigegeben.');
  if(!(stock.thickness>0))errors.push('Rohlingdicke muss größer als 0 sein.');
  if(!Number.isFinite(rawOvercut)||rawOvercut<0)errors.push('Overcut muss eine Zahl größer oder gleich 0 sein.');
  const depth=Math.max(0,stock.thickness)+overcut;
  if(overcut>2)warnings.push(`Overcut ${overcut.toFixed(3)} mm ist ungewöhnlich groß. Opferplatte und Spannmittel prüfen.`);
  return{ok:errors.length===0,depthMm:depth,bottomZMm:-depth,errors,warnings,mode,overcutMm:overcut};
}

export function contourOperationWithResolvedDepth(args:{operation:ContourOperation;stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem}){
  const resolution=resolveContourDepth(args);
  return{resolution,operation:{...args.operation,totalDepthMm:resolution.depthMm}};
}
