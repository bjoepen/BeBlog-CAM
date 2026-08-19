import type { CamOperation, ContourOperation, PocketOperation, CarveOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateContourGcode } from './gcode';
import { generatePocketGcode } from './pocketGcode';
import { generateCarveGcode } from './carveGcode';

export type JobGcodeResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  code:string;
  lineCount:number;
  operationCount:number;
  toolChangeCount:number;
};

type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[]};

type OperationCode={ok:boolean;errors:string[];warnings:string[];code:string};
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const label=(op:CamOperation)=>op.kind==='contour'?'Kontur':op.kind==='pocket'?'Tasche':'Carve';
const toolKey=(op:CamOperation)=>`${op.tool.name}|${op.tool.diameterMm.toFixed(6)}`;

function generateOperation(args:Args,operation:CamOperation):OperationCode{
  const common={summary:args.summary,stock:args.stock,stockMode:args.stockMode,placement:args.placement,orientation:args.orientation,wcs:args.wcs};
  if(operation.kind==='contour')return generateContourGcode({...common,operation:operation as ContourOperation});
  if(operation.kind==='pocket')return generatePocketGcode({...common,operation:operation as PocketOperation});
  return generateCarveGcode({...common,operation:operation as CarveOperation});
}

/**
 * Individual generators remain the verified source of truth. Gate 7B composes
 * their already-validated programs instead of reimplementing geometry.
 * Only program wrappers (G21/G90/G17/M30) are removed; operation motion stays unchanged.
 */
function operationBody(code:string):string[]{
  return code.split(/\r?\n/).filter(line=>{
    const t=line.trim();
    if(!t)return false;
    if(t==='G21'||t==='G90'||t==='G17'||t==='M30')return false;
    if(/^\( BeBlog CAM /.test(t))return false;
    return true;
  });
}

export function generateJobGcode(args:Args):JobGcodeResult{
  const operations=args.operations.filter(op=>op.enabled);
  const errors:string[]=[],warnings:string[]=[];
  if(!operations.length)return{ok:false,errors:['Keine aktive Bearbeitung im Projekt.'],warnings,code:'',lineCount:0,operationCount:0,toolChangeCount:0};

  const generated=operations.map((operation,index)=>{
    const result=generateOperation(args,operation);
    if(!result.ok)for(const error of result.errors)errors.push(`Bearbeitung ${index+1} · ${label(operation)}: ${error}`);
    for(const warning of result.warnings)warnings.push(`Bearbeitung ${index+1} · ${label(operation)}: ${warning}`);
    return{operation,result};
  });
  if(errors.length)return{ok:false,errors,warnings,code:'',lineCount:0,operationCount:operations.length,toolChangeCount:0};

  const lines:string[]=[];
  lines.push('( BeBlog CAM 001I )','( Gesamtjob · mehrere gepruefte 2D-Bearbeitungen )',`( ${operations.length} Bearbeitungen )`,'G21','G90','G17');
  let toolChangeCount=0;

  generated.forEach(({operation,result},index)=>{
    if(index>0){
      const previous=generated[index-1].operation;
      if(toolKey(previous)!==toolKey(operation)){
        toolChangeCount++;
        const safe=Math.max(previous.safeZMm,operation.safeZMm);
        lines.push(`G0 Z${f3(safe)}`,'M5',`( Werkzeugwechsel ${toolChangeCount} )`,`M0 ( Werkzeug ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm einsetzen und bestaetigen )`);
      }else{
        lines.push(`( Gleiches Werkzeug · ${operation.tool.name} · Ø${f3(operation.tool.diameterMm)} mm )`);
      }
    }
    lines.push(`( Bearbeitung ${index+1}/${operations.length} · ${label(operation)} · ${operation.name} )`);
    lines.push(...operationBody(result.code));
  });

  const finalSafe=Math.max(...operations.map(op=>op.safeZMm));
  lines.push(`G0 Z${f3(finalSafe)}`,'M5','M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings,code,lineCount:lines.length,operationCount:operations.length,toolChangeCount};
}
