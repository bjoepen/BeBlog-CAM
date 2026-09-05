import type { CamOperation, FacingOperation, ContourOperation, PocketOperation, CarveOperation, DrillOperation, ZLevelRoughingOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateFacingGcode } from './facingGcode';
import { generateContourGcode } from './gcode';
import { postContourCanonicalToolpath } from './contourCanonicalToolpath';
import { buildStepContourOperationState } from './stepContourOperation';
import { generatePocketGcode } from './pocketGcode';
import { generateStepPocketGcode } from './stepPocketGcode';
import { optimizeParallelPocketStayDown } from './pocketStayDown';
import { generateCarveGcode } from './carveGcode';
import { generateCanonicalDrillGcode } from './drillCanonicalToolpath';
import { generateStepDrillGcode } from './stepDrillGcode';
import { normalizeGcodeComments } from './gcodeComments';
import { buildZLevelOperationState, zLevelMode } from './zLevelOperationState';
import { postFaceTargetCanonicalToolpath } from './faceTargetToolpath';
import { buildSurfaceFinishingOperationState } from './surfaceFinishingOperation';
import { postSurfaceFinishingCanonicalToolpath } from './surfaceFinishingGcode';
import { validateJob } from './jobPreflight';
import { toolIdentityKey } from './toolIdentity.js';

export type JobGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;operationCount:number;toolChangeCount:number;};
type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[]};
type OperationCode={ok:boolean;errors:string[];warnings:string[];code:string};
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);
const label=(op:CamOperation)=>op.kind==='facing'?'Planen':op.kind==='contour'?'Kontur':op.kind==='pocket'?'Tasche':op.kind==='carve'?'Carve':op.kind==='drill'?'Bohren':op.kind==='surface-finishing'?'3D Schlichten':'Z-Level Schruppen';
const toolKey=(op:CamOperation)=>toolIdentityKey(op);
const operationDisplayName=(op:CamOperation,index:number)=>{const expected=label(op),name=op.name.trim();return name.startsWith(expected)?name:`${expected} ${index+1}`;};

function generateOperation(args:Args,operation:CamOperation):OperationCode{
  const common={summary:args.summary,stock:args.stock,stockMode:args.stockMode,placement:args.placement,orientation:args.orientation,wcs:args.wcs};
  if(operation.kind==='facing')return generateFacingGcode({stock:args.stock,stockMode:args.stockMode,wcs:args.wcs,operation:operation as FacingOperation});
  if(operation.kind==='contour'){
    const contour=operation as ContourOperation;
    if(args.summary.kind==='step'){const state=buildStepContourOperationState({...common,operation:contour});if(!state.ok||!state.toolpath)return{ok:false,errors:state.errors,warnings:state.warnings,code:''};try{return{ok:true,errors:[],warnings:state.warnings,code:normalizeGcodeComments(postContourCanonicalToolpath(state.toolpath,{safeZMm:contour.safeZMm,feedMmMin:contour.feedMmMin,plungeMmMin:contour.plungeMmMin,spindleRpm:contour.spindleRpm}))};}catch(error){return{ok:false,errors:[String(error)],warnings:state.warnings,code:''};}}
    return generateContourGcode({...common,operation:contour});
  }
  if(operation.kind==='pocket'){
    const pocket=operation as PocketOperation;
    if(pocket.restMachiningEnabled){
      const currentIndex=args.operations.findIndex(op=>op.id===pocket.id),sourceIndex=args.operations.findIndex(op=>op.id===pocket.restFromOperationId),source=sourceIndex>=0?args.operations[sourceIndex]:null;
      if(!source||source.kind!=='pocket')return{ok:false,errors:['Restmaterial benötigt eine gültige vorherige Taschenbearbeitung.'],warnings:[],code:''};
      if(sourceIndex>=currentIndex)return{ok:false,errors:['Restmaterialquelle muss im Job vor der aktuellen Taschenbearbeitung liegen.'],warnings:[],code:''};
      if(source.tool.diameterMm<=pocket.tool.diameterMm)return{ok:false,errors:['Restmaterial benötigt ein kleineres Folgewerkzeug als die vorherige Taschenbearbeitung.'],warnings:[],code:''};
      const build=(op:PocketOperation)=>{if(args.summary.kind==='step'){const state=buildStepPocketOperationState({...common,operation:op});return state.ok?state.toolpath:null;}return buildPocketCanonicalToolpath({...common,operation:op});};
      const previous=build(source),current=build(pocket);if(!previous||!current)return{ok:false,errors:['Restmaterial konnte die kanonischen Taschenbahnen nicht rekonstruieren.'],warnings:[],code:''};
      const rest=applyPocketRestMachining({current,previous,currentToolDiameterMm:pocket.tool.diameterMm,previousToolDiameterMm:source.tool.diameterMm});if(rest.errors.length)return{ok:false,errors:rest.errors,warnings:rest.warnings,code:''};
      if(!rest.toolpath)return{ok:true,errors:[],warnings:rest.warnings,code:'( BeBlog CAM 004N )\n( Kein Restmaterial vorhanden )\nG21\nG90\nG17\nM30\n'};
      const code=postPocketCanonicalToolpath(rest.toolpath,{safeZMm:pocket.safeZMm,feedMmMin:pocket.feedMmMin,plungeMmMin:pocket.plungeMmMin,spindleRpm:pocket.spindleRpm});return{ok:true,errors:[],warnings:rest.warnings,code:normalizeGcodeComments(code)};
    }
    if(args.summary.kind==='step'){const r=generateStepPocketGcode({...common,operation:pocket});return{...r,code:normalizeGcodeComments(r.code)};}
    const result=generatePocketGcode({...common,operation:pocket});if(!result.ok)return result;const optimized=optimizeParallelPocketStayDown(result.code,pocket);return{...result,code:normalizeGcodeComments(optimized.code)};
  }
  if(operation.kind==='drill'){const drill=operation as DrillOperation;const r=args.summary.kind==='step'?generateStepDrillGcode({...common,operation:drill}):generateCanonicalDrillGcode({...common,operation:drill});return{...r,code:normalizeGcodeComments(r.code)};}
  if(operation.kind==='carve'){const r=generateCarveGcode({...common,operation:operation as CarveOperation});return{...r,code:normalizeGcodeComments(r.code)};}
  if(operation.kind==='surface-finishing'){const state=buildSurfaceFinishingOperationState({summary:args.summary,stock:args.stock,placement:args.placement,orientation:args.orientation,wcs:args.wcs,operation});if(!state.ok||!state.toolpath)return{ok:false,errors:state.errors.length?state.errors:['3D-Schlichtwerkzeugweg konnte nicht rekonstruiert werden.'],warnings:state.warnings,code:''};const posted=postSurfaceFinishingCanonicalToolpath(state.toolpath,operation);return{...posted,code:posted.ok?normalizeGcodeComments(posted.code):''};}
  if(operation.kind==='z-level-roughing'){const roughing=operation as ZLevelRoughingOperation;const state=buildZLevelOperationState({summary:args.summary,stock:args.stock,placement:args.placement,orientation:args.orientation,wcs:args.wcs,operation:roughing});if(!state.toolpath||state.errors.length)return{ok:false,errors:state.errors.length?state.errors:['Z-Level-Schruppbahn konnte nicht rekonstruiert werden.'],warnings:state.warnings,code:''};try{const code=postFaceTargetCanonicalToolpath(state.toolpath,{safeZMm:roughing.safeZMm,feedMmMin:roughing.feedMmMin,plungeMmMin:roughing.plungeMmMin,spindleRpm:roughing.spindleRpm,source:zLevelMode(roughing)});return{ok:true,errors:[],warnings:state.warnings,code:normalizeGcodeComments(code)};}catch(error){return{ok:false,errors:[String(error)],warnings:[],code:''};}}
  return generateContourGcode({...common,operation:operation as ContourOperation});
}

function operationBody(code:string):string[]{const body=code.split(/\r?\n/).filter(line=>{const t=line.trim();if(!t)return false;if(t==='G21'||t==='G90'||t==='G17'||t==='M30')return false;if(/^\( BeBlog CAM /.test(t))return false;return true;});while(body.length){const t=body[body.length-1].trim();if(t==='M5'||/^G0\s+Z[-+]?\d+(?:\.\d+)?$/i.test(t)){body.pop();continue;}break;}return body;}
export function generateJobGcode(args:Args):JobGcodeResult{const operations=args.operations.filter(op=>op.enabled),preflight=validateJob(args);if(preflight.level==='fail')return{ok:false,errors:['Gesamtjob ist durch den Preflight nicht freigegeben.',...preflight.errors],warnings:preflight.warnings,code:'',lineCount:0,operationCount:operations.length,toolChangeCount:preflight.toolChanges};const errors:string[]=[],warnings:string[]=[...preflight.warnings];if(!operations.length)return{ok:false,errors:['Keine aktive Bearbeitung im Projekt.'],warnings,code:'',lineCount:0,operationCount:0,toolChangeCount:0};const generated=operations.map((operation,index)=>{const result=generateOperation(args,operation);if(!result.ok)for(const error of result.errors)errors.push(`Bearbeitung ${index+1} · ${label(operation)}: ${error}`);for(const warning of result.warnings)warnings.push(`Bearbeitung ${index+1} · ${label(operation)}: ${warning}`);return{operation,result};});if(errors.length)return{ok:false,errors,warnings,code:'',lineCount:0,operationCount:operations.length,toolChangeCount:0};const lines:string[]=[];lines.push('( BeBlog CAM 001Z-A )','( Gesamtjob · kanonische Einzelpfade werden zu einem gemeinsamen Maschinenprogramm verbunden )',`( ${operations.length} Bearbeitungen )`,'G21','G90','G17');let toolChangeCount=0;generated.forEach(({operation,result},index)=>{lines.push(`( Bearbeitung ${index+1}/${operations.length} · ${label(operation)} · ${operationDisplayName(operation,index)} )`);lines.push(...operationBody(result.code));const next=generated[index+1]?.operation;if(!next)return;const safe=Math.max(operation.safeZMm,next.safeZMm);lines.push(`G0 Z${f3(safe)}`);if(toolKey(operation)!==toolKey(next)){toolChangeCount++;lines.push('M5',`( Werkzeugwechsel ${toolChangeCount} )`,`M0 ( Werkzeug ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm einsetzen und bestaetigen )`);}else lines.push(`( Gleiches Werkzeug · ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm )`);});const finalSafe=Math.max(...operations.map(op=>op.safeZMm));lines.push(`G0 Z${f3(finalSafe)}`,'M5','M30');const code=lines.join('\n')+'\n';return{ok:true,errors:[],warnings:[...new Set(warnings)],code,lineCount:lines.length,operationCount:operations.length,toolChangeCount};}
