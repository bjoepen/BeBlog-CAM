import type { CamOperation, FacingOperation, ContourOperation, PocketOperation, CarveOperation, DrillOperation, ZLevelRoughingOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateFacingGcode } from './facingGcode';
import { generateContourGcode } from './gcode';
import { generatePocketGcode } from './pocketGcode';
import { optimizeParallelPocketStayDown } from './pocketStayDown';
import { generateCarveGcode } from './carveGcode';
import { generateCanonicalDrillGcode } from './drillCanonicalToolpath';
import { normalizeGcodeComments } from './gcodeComments';
import { buildFaceTargetOperationState } from './faceTargetOperation';
import { postFaceTargetCanonicalToolpath } from './faceTargetToolpath';

export type JobGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;operationCount:number;toolChangeCount:number;};
type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[]};
type OperationCode={ok:boolean;errors:string[];warnings:string[];code:string};
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const label=(op:CamOperation)=>op.kind==='facing'?'Planen':op.kind==='contour'?'Kontur':op.kind==='pocket'?'Tasche':op.kind==='carve'?'Carve':op.kind==='drill'?'Bohren':'Z-Level Schruppen';
const toolKey=(op:CamOperation)=>`${op.tool.name}|${op.tool.diameterMm.toFixed(6)}`;
const operationDisplayName=(op:CamOperation,index:number)=>{
  const expected=label(op),name=op.name.trim();
  return name.startsWith(expected)?name:`${expected} ${index+1}`;
};

function generateOperation(args:Args,operation:CamOperation):OperationCode{
  const common={summary:args.summary,stock:args.stock,stockMode:args.stockMode,placement:args.placement,orientation:args.orientation,wcs:args.wcs};
  if(operation.kind==='facing')return generateFacingGcode({stock:args.stock,stockMode:args.stockMode,wcs:args.wcs,operation:operation as FacingOperation});
  if(operation.kind==='contour')return generateContourGcode({...common,operation:operation as ContourOperation});
  if(operation.kind==='pocket'){
    const pocket=operation as PocketOperation,result=generatePocketGcode({...common,operation:pocket});
    if(!result.ok)return result;const optimized=optimizeParallelPocketStayDown(result.code,pocket);return{...result,code:normalizeGcodeComments(optimized.code)};
  }
  if(operation.kind==='drill'){const r=generateCanonicalDrillGcode({...common,operation:operation as DrillOperation});return{...r,code:normalizeGcodeComments(r.code)};}
  if(operation.kind==='carve'){const r=generateCarveGcode({...common,operation:operation as CarveOperation});return{...r,code:normalizeGcodeComments(r.code)};}
  if(operation.kind==='z-level-roughing'){
    const roughing=operation as ZLevelRoughingOperation;
    const state=buildFaceTargetOperationState({summary:args.summary,stock:args.stock,placement:args.placement,orientation:args.orientation,wcs:args.wcs,operation:roughing});
    if(!state)return{ok:false,errors:['Die operation-owned STEP/BRep-Zielfläche konnte nicht als Z-Level-Schruppbahn rekonstruiert werden.'],warnings:[],code:''};
    try{
      const code=postFaceTargetCanonicalToolpath(state.toolpath,{safeZMm:roughing.safeZMm,feedMmMin:roughing.feedMmMin,plungeMmMin:roughing.plungeMmMin,spindleRpm:roughing.spindleRpm});
      return{ok:true,errors:[],warnings:[],code:normalizeGcodeComments(code)};
    }catch(error){
      return{ok:false,errors:[String(error)],warnings:[],code:''};
    }
  }
  return generateContourGcode({...common,operation:operation as ContourOperation});
}

function operationBody(code:string):string[]{
  const body=code.split(/\r?\n/).filter(line=>{const t=line.trim();if(!t)return false;if(t==='G21'||t==='G90'||t==='G17'||t==='M30')return false;if(/^\( BeBlog CAM /.test(t))return false;return true;});
  while(body.length){const t=body[body.length-1].trim();if(t==='M5'||/^G0\s+Z[-+]?\d+(?:\.\d+)?$/i.test(t)){body.pop();continue;}break;}return body;
}

export function generateJobGcode(args:Args):JobGcodeResult{
  const operations=args.operations.filter(op=>op.enabled);const errors:string[]=[],warnings:string[]=[];
  if(!operations.length)return{ok:false,errors:['Keine aktive Bearbeitung im Projekt.'],warnings,code:'',lineCount:0,operationCount:0,toolChangeCount:0};
  const generated=operations.map((operation,index)=>{const result=generateOperation(args,operation);if(!result.ok)for(const error of result.errors)errors.push(`Bearbeitung ${index+1} · ${label(operation)}: ${error}`);for(const warning of result.warnings)warnings.push(`Bearbeitung ${index+1} · ${label(operation)}: ${warning}`);return{operation,result};});
  if(errors.length)return{ok:false,errors,warnings,code:'',lineCount:0,operationCount:operations.length,toolChangeCount:0};
  const lines:string[]=[];lines.push('( BeBlog CAM 001Z-A )','( Gesamtjob · kanonische Einzelpfade werden zu einem gemeinsamen Maschinenprogramm verbunden )',`( ${operations.length} Bearbeitungen )`,'G21','G90','G17');let toolChangeCount=0;
  generated.forEach(({operation,result},index)=>{
    lines.push(`( Bearbeitung ${index+1}/${operations.length} · ${label(operation)} · ${operationDisplayName(operation,index)} )`);lines.push(...operationBody(result.code));
    const next=generated[index+1]?.operation;if(!next)return;const safe=Math.max(operation.safeZMm,next.safeZMm);lines.push(`G0 Z${f3(safe)}`);
    if(toolKey(operation)!==toolKey(next)){toolChangeCount++;lines.push('M5',`( Werkzeugwechsel ${toolChangeCount} )`,`M0 ( Werkzeug ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm einsetzen und bestaetigen )`);}else lines.push(`( Gleiches Werkzeug · ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm )`);
  });
  const finalSafe=Math.max(...operations.map(op=>op.safeZMm));lines.push(`G0 Z${f3(finalSafe)}`,'M5','M30');const code=lines.join('\n')+'\n';return{ok:true,errors:[],warnings,code,lineCount:lines.length,operationCount:operations.length,toolChangeCount};
}
