import type { CamOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateContourGcode } from './gcode';
import { generatePocketGcode } from './pocketGcode';
import { validateCarveOperation } from './carveMath';

export type JobPreflightLevel='pass'|'warn'|'fail';
export type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;level:JobPreflightLevel;errors:string[];warnings:string[]};
export type JobPreflightResult={level:JobPreflightLevel;operations:JobPreflightOperation[];enabledCount:number;toolChanges:number;errors:string[];warnings:string[]};

const kindLabel=(kind:CamOperation['kind'])=>kind==='contour'?'Kontur':kind==='pocket'?'Tasche':'Carve';
const toolKey=(op:CamOperation)=>`${op.tool.name}|${op.tool.diameterMm.toFixed(6)}`;

export function validateJob(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[]}):JobPreflightResult{
  const {summary,stock,stockMode,placement,orientation,wcs}=args;
  const enabled=args.operations.filter(op=>op.enabled!==false);
  const operations:JobPreflightOperation[]=[];const errors:string[]=[];const warnings:string[]=[];
  enabled.forEach((operation,index)=>{
    let opErrors:string[]=[];let opWarnings:string[]=[];let detail='';
    if(operation.kind==='carve'){
      const r=validateCarveOperation(summary,operation);opErrors=[...r.errors];opWarnings=[...r.warnings];
      if(stockMode==='none')opWarnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.');
      if(wcs.z!=='top')opErrors.push('WCS Unterseite ist für Carve noch nicht freigegeben.');
      detail=`${r.segments.length} Linien · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
    }else if(operation.kind==='pocket'){
      const r=generatePocketGcode({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`Tasche · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
    }else{
      const r=generateContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`${operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie'} · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
    }
    const level:JobPreflightLevel=opErrors.length?'fail':opWarnings.length?'warn':'pass';
    const label=operation.name||kindLabel(operation.kind);operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,level,errors:opErrors,warnings:opWarnings});
    errors.push(...opErrors.map(e=>`Bearbeitung ${index+1} (${kindLabel(operation.kind)}): ${e}`));warnings.push(...opWarnings.map(w=>`Bearbeitung ${index+1} (${kindLabel(operation.kind)}): ${w}`));
  });
  if(!enabled.length)errors.push('Der Gesamtjob enthält keine aktivierte Bearbeitung.');
  let toolChanges=0;for(let i=1;i<enabled.length;i++)if(toolKey(enabled[i])!==toolKey(enabled[i-1]))toolChanges++;
  const level:JobPreflightLevel=errors.length?'fail':warnings.length?'warn':'pass';
  return{level,operations,enabledCount:enabled.length,toolChanges,errors,warnings};
}
