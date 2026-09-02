import type { FacingOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { validateToolCompatibility } from './validationGrammar';
import { buildFacingToolpath } from './facingToolpath';

export type FacingPathResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  code:string;
  lineCount:number;
  lanes:number;
  levels:number;
  stepoverMm:number;
};

const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

export function validateFacing(args:{stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem;operation:FacingOperation}){
  const {stock,stockMode,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(stockMode==='none')errors.push('Planen benötigt einen definierten rechteckigen Rohling.');
  if(!(stock.width>0&&stock.height>0&&stock.thickness>0))errors.push('Rohlingbreite, -länge und -dicke müssen größer als 0 sein.');
  if(wcs.z!=='top')errors.push('Planen ist nur mit Z-Null auf der Rohlingoberseite freigegeben.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.stepoverPercent>0&&operation.stepoverPercent<=90))errors.push('Seitliche Zustellung muss größer als 0 % und höchstens 90 % sein.');
  if(!(operation.totalDepthMm>0))errors.push('Planabtrag muss größer als 0 sein.');
  if(!(operation.stepDownMm>0))errors.push('Zustellung pro Durchgang muss größer als 0 sein.');
  if(operation.totalDepthMm>stock.thickness)errors.push(`Planabtrag ${operation.totalDepthMm.toFixed(3)} mm überschreitet die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`);
  if(!(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0))errors.push('Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(!(operation.safeZMm>0))errors.push('Sicherheits-Z muss größer als 0 sein.');
  const compatibility=validateToolCompatibility(operation);
  if(compatibility.level==='fail')errors.push(compatibility.detail);
  else if(compatibility.level==='warn')warnings.push(compatibility.detail);
  return{errors,warnings};
}

export function generateFacingGcode(args:{stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem;operation:FacingOperation}):FacingPathResult{
  const {stock,wcs,operation}=args;
  const validation=validateFacing(args),errors=[...validation.errors],warnings=[...validation.warnings];
  if(errors.length)return{ok:false,errors,warnings,code:'',lineCount:0,lanes:0,levels:0,stepoverMm:0};

  const planned=buildFacingToolpath({stock,wcs,operation});
  const lines:string[]=[];
  lines.push('( BeBlog CAM 001X )','( Planen · rechteckiger Rohling · Zickzack )','G21','G90','G17',`S${Math.round(operation.spindleRpm)}`,'M3');

  planned.toolpath.runs.forEach((run,index)=>{
    const first=run.points[0];
    lines.push(
      `( Planstufe ${index+1}/${planned.levels} · Z${f3(run.z)} )`,
      `G0 Z${f3(operation.safeZMm)}`,
      `G0 X${f3(first.x)} Y${f3(first.y)}`,
      `G1 Z${f3(run.z)} F${Math.round(operation.plungeMmMin)}`,
    );
    for(const point of run.points.slice(1))lines.push(`G1 X${f3(point.x)} Y${f3(point.y)} F${Math.round(operation.feedMmMin)}`);
  });

  lines.push(`G0 Z${f3(operation.safeZMm)}`,'M5','M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings,code,lineCount:lines.length,lanes:planned.lanes,levels:planned.levels,stepoverMm:planned.stepoverMm};
}
