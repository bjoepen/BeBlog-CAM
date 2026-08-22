import type { FacingOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

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

function axisBounds(length:number,origin:'min'|'center'|'max'){
  if(origin==='min')return{min:0,max:length};
  if(origin==='max')return{min:-length,max:0};
  return{min:-length/2,max:length/2};
}

function buildLanes(min:number,max:number,requested:number){
  const span=max-min;
  if(span<=0)return[min];
  const count=Math.max(1,Math.ceil(span/requested));
  const step=span/count;
  return Array.from({length:count+1},(_,i)=>min+step*i);
}

export function validateFacing(args:{stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem;operation:FacingOperation}){
  const {stock,stockMode,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(stockMode==='none')errors.push('Planen benötigt einen definierten rechteckigen Rohling.');
  if(!(stock.width>0&&stock.height>0&&stock.thickness>0))errors.push('Rohlingbreite, -länge und -dicke müssen größer als 0 sein.');
  if(wcs.z!=='top')errors.push('Planen ist in 001U nur mit Z-Null auf der Rohlingoberseite freigegeben.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.stepoverPercent>0&&operation.stepoverPercent<=90))errors.push('Seitliche Zustellung muss größer als 0 % und höchstens 90 % sein.');
  if(!(operation.totalDepthMm>0))errors.push('Planabtrag muss größer als 0 sein.');
  if(!(operation.stepDownMm>0))errors.push('Zustellung pro Durchgang muss größer als 0 sein.');
  if(operation.totalDepthMm>stock.thickness)errors.push(`Planabtrag ${operation.totalDepthMm.toFixed(3)} mm überschreitet die Rohlingdicke ${stock.thickness.toFixed(3)} mm.`);
  if(!(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0))errors.push('Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(!(operation.safeZMm>0))errors.push('Sicherheits-Z muss größer als 0 sein.');
  if(operation.tool.kind==='ball-nose'||operation.tool.kind==='v-bit')errors.push('Vollradius- und V-Fräser sind für Planen in 001U nicht freigegeben.');
  else if(operation.tool.kind==='end-mill'||!operation.tool.kind)warnings.push('Schaftfräser ist zulässig; für größere Planflächen ist ein Planfräser die bevorzugte Werkzeugart.');
  return{errors,warnings};
}

export function generateFacingGcode(args:{stock:StockDefinition;stockMode:StockMode;wcs:WorkCoordinateSystem;operation:FacingOperation}):FacingPathResult{
  const {stock,wcs,operation}=args;
  const validation=validateFacing(args),errors=[...validation.errors],warnings=[...validation.warnings];
  if(errors.length)return{ok:false,errors,warnings,code:'',lineCount:0,lanes:0,levels:0,stepoverMm:0};

  const requestedStepover=operation.tool.diameterMm*operation.stepoverPercent/100;
  const x=axisBounds(stock.width,wcs.x==='left'?'min':wcs.x==='right'?'max':'center');
  const y=axisBounds(stock.height,wcs.y==='front'?'min':wcs.y==='back'?'max':'center');
  const traverse=operation.direction==='x'?x:y;
  const cross=operation.direction==='x'?y:x;
  const lanes=buildLanes(cross.min,cross.max,requestedStepover);
  const actualStepover=lanes.length>1?(cross.max-cross.min)/(lanes.length-1):0;
  const radius=operation.tool.diameterMm/2;
  const startTraverse=traverse.min-radius;
  const endTraverse=traverse.max+radius;
  const levels=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm));
  const lines:string[]=[];
  lines.push('( BeBlog CAM 001U )','( Planen · rechteckiger Rohling · Zickzack )','G21','G90','G17',`S${Math.round(operation.spindleRpm)}`,'M3');

  for(let level=1;level<=levels;level++){
    const z=-Math.min(level*operation.stepDownMm,operation.totalDepthMm);
    lines.push(`( Planstufe ${level}/${levels} · Z${f3(z)} )`,`G0 Z${f3(operation.safeZMm)}`);
    lanes.forEach((crossValue,index)=>{
      const forward=index%2===0;
      const a=forward?startTraverse:endTraverse;
      const b=forward?endTraverse:startTraverse;
      const start=operation.direction==='x'?{x:a,y:crossValue}:{x:crossValue,y:a};
      const end=operation.direction==='x'?{x:b,y:crossValue}:{x:crossValue,y:b};
      lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
      if(index===0)lines.push(`G1 Z${f3(z)} F${Math.round(operation.plungeMmMin)}`);
      else lines.push(`G1 Z${f3(z)} F${Math.round(operation.plungeMmMin)}`);
      lines.push(`G1 X${f3(end.x)} Y${f3(end.y)} F${Math.round(operation.feedMmMin)}`);
    });
  }
  lines.push(`G0 Z${f3(operation.safeZMm)}`,'M5','M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings,code,lineCount:lines.length,lanes:lanes.length,levels,stepoverMm:actualStepover};
}
