import type { CamOperation, FacingOperation, ContourOperation, PocketOperation, CarveOperation, DrillOperation, ZLevelRoughingOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateFacingGcode } from './facingGcode';
import { generateContourGcode } from './gcode';
import { postContourCanonicalToolpath } from './contourCanonicalToolpath';
import { buildStepContourOperationState } from './stepContourOperation';
import { generatePocketGcode } from './pocketGcode';
import { generateStepPocketGcode } from './stepPocketGcode';
import { buildStepPocketOperationState } from './stepPocketOperation';
import { buildPocketCanonicalToolpath, postPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { applyPocketRestMachining } from './pocketRestMachining';
import { applyPocketStockAwareRoughing } from './pocketStockAwareRoughing';
import { optimizeParallelPocketStayDown } from './pocketStayDown';
import { generateCarveGcode } from './carveGcode';
import { generateCanonicalDrillGcode } from './drillCanonicalToolpath';
import { generateStepDrillGcode } from './stepDrillGcode';
import { normalizeGcodeComments } from './gcodeComments';
import { buildZLevelOperationState, zLevelMode } from './zLevelOperationState';
import { postFaceTargetCanonicalToolpath } from './faceTargetToolpath';
import { buildSurfaceFinishingOperationState } from './surfaceFinishingOperation';
import { postSurfaceFinishingCanonicalToolpath } from './surfaceFinishingGcode';
import { validateJob, type JobPreflightResult } from './jobPreflight';
import { toolIdentityKey } from './toolIdentity.js';
import type { FixtureVolume } from './fixtureCollision';
import type { MachineEnvelope, MachineWcsOrigin } from './machineEnvelope';
import { buildJobSafeTransitions } from './safeMotionChain';
import { postCanonicalMachineMotions } from './canonicalMotionGcode';
import type { SpindleHeadGeometry } from './spindleHeadCollision';

export type JobGcodeResult={ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;operationCount:number;toolChangeCount:number;};
type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[];fixtures?:FixtureVolume[];machineEnvelope?:MachineEnvelope|null;machineWcsOrigin?:MachineWcsOrigin|null;spindleHead?:SpindleHeadGeometry|null;preflight?:JobPreflightResult};
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
      if(args.summary.kind==='step'&&source.stepFaceId!==pocket.stepFaceId)return{ok:false,errors:['Restmaterialquelle und Folgeoperation müssen dieselbe STEP-Taschenfläche verwenden.'],warnings:[],code:''};
      if(args.summary.kind==='dxf'&&source.contourId!==pocket.contourId)return{ok:false,errors:['Restmaterialquelle und Folgeoperation müssen dieselbe DXF-Taschenkontur verwenden.'],warnings:[],code:''};
      const build=(op:PocketOperation)=>{if(args.summary.kind==='step'){const state=buildStepPocketOperationState({...common,operation:op});return state.ok?state.toolpath:null;}return buildPocketCanonicalToolpath({...common,operation:op});};
      const previous=build(source),current=build(pocket);if(!previous||!current)return{ok:false,errors:['Restmaterial konnte die kanonischen Taschenbahnen nicht rekonstruieren.'],warnings:[],code:''};
      const rest=applyPocketRestMachining({current,previous,currentToolDiameterMm:pocket.tool.diameterMm,previousToolDiameterMm:source.tool.diameterMm});if(rest.errors.length)return{ok:false,errors:rest.errors,warnings:rest.warnings,code:''};
      if(!rest.toolpath)return{ok:true,errors:[],warnings:rest.warnings,code:'( BeBlog CAM 004N )\n( Kein Restmaterial vorhanden )\nG21\nG90\nG17\nM30\n'};
      const code=postPocketCanonicalToolpath(rest.toolpath,{safeZMm:pocket.safeZMm,feedMmMin:pocket.feedMmMin,plungeMmMin:pocket.plungeMmMin,spindleRpm:pocket.spindleRpm});return{ok:true,errors:[],warnings:rest.warnings,code:normalizeGcodeComments(code)};
    }
    if(pocket.stockAwareRoughingEnabled){
      const base=args.summary.kind==='step'?buildStepPocketOperationState({...common,operation:pocket}).toolpath:buildPocketCanonicalToolpath({...common,operation:pocket});
      if(!base)return{ok:false,errors:['Stock-aware Roughing konnte die kanonische Taschenbahn nicht rekonstruieren.'],warnings:[],code:''};
      const adaptive=applyPocketStockAwareRoughing({toolpath:base,toolDiameterMm:pocket.tool.diameterMm,maxRadialEngagementPercent:pocket.maxRadialEngagementPercent??35});
      if(adaptive.errors.length||!adaptive.toolpath)return{ok:false,errors:adaptive.errors.length?adaptive.errors:['Stock-aware Roughing erzeugte keinen freigegebenen Werkzeugweg.'],warnings:adaptive.warnings,code:''};
      const code=postPocketCanonicalToolpath(adaptive.toolpath,{safeZMm:pocket.safeZMm,feedMmMin:pocket.feedMmMin,plungeMmMin:pocket.plungeMmMin,spindleRpm:pocket.spindleRpm});return{ok:true,errors:[],warnings:adaptive.warnings,code:normalizeGcodeComments(code)};
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
function contourMotionParity(operation:CamOperation,toolpath:import('./canonicalToolpath').CanonicalToolpath):string[]{
  if(operation.kind!=='contour'||!toolpath.runs.length||!toolpath.motions?.length)return[];
  const key=(z:number)=>Math.round(z*1000000)/1000000;
  const required=[...new Set(toolpath.runs.map(run=>key(run.z)))];
  const present=new Set(toolpath.motions.filter(motion=>motion.kind!=='rapid3'&&Math.abs(motion.start.z-motion.end.z)<1e-7).map(motion=>key(motion.end.z)));
  const missing=required.filter(z=>!present.has(z));
  return missing.length?[`004Z-A NC-Parität: ${missing.length} Kontur-Z-Ebene${missing.length===1?'':'n'} aus dem geprüften kanonischen Toolpath fehlen in den materialisierten Maschinenbewegungen: ${missing.map(z=>z.toFixed(3)).join(', ')} mm.`]:[];
}

export function generateJobGcode(args:Args):JobGcodeResult{
  const enabled=args.operations.filter(op=>op.enabled!==false),preflight=args.preflight??validateJob(args);
  if(preflight.level==='fail')return{ok:false,errors:['Gesamtjob ist durch den Preflight nicht freigegeben.',...preflight.errors],warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  if(!enabled.length)return{ok:false,errors:['Keine aktive Bearbeitung im Projekt.'],warnings:preflight.warnings,code:'',lineCount:0,operationCount:0,toolChangeCount:0};
  const prepared=enabled.map((operation,index)=>({operation,preflight:preflight.operations[index]}));
  const missing=prepared.filter(item=>!item.preflight?.toolpath);
  if(missing.length)return{ok:false,errors:missing.map(item=>`Bearbeitung ${item.operation.name}: 004T liefert keinen materialisierten Werkzeugweg.`),warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const parityErrors=prepared.flatMap(item=>contourMotionParity(item.operation,item.preflight!.toolpath!).map(message=>`${item.operation.name}: ${message}`));
  if(parityErrors.length)return{ok:false,errors:parityErrors,warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const firstToolpath=prepared[0].preflight!.toolpath!;
  const firstMotion=firstToolpath.motions?.[0];
  if(!firstMotion)return{ok:false,errors:['004T Initial Entry: erste Operation besitzt keine materialisierte Startbewegung.'],warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const firstStart=firstMotion.start;
  if(Math.abs(firstStart.z-prepared[0].operation.safeZMm)>1e-9)return{ok:false,errors:[`004T Initial Entry: erster Startanker liegt bei Z${f3(firstStart.z)} statt auf Safe-Z ${f3(prepared[0].operation.safeZMm)}.`],warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const transitions=buildJobSafeTransitions({operations:prepared.map(item=>({id:item.operation.id,safeZMm:item.operation.safeZMm,toolpath:item.preflight!.toolpath!}))});
  if(!transitions.ok)return{ok:false,errors:transitions.errors,warnings:preflight.warnings,code:'',lineCount:0,operationCount:enabled.length,toolChangeCount:preflight.toolChanges};
  const lines:string[]=['( BeBlog CAM 004T )','( Gesamtjob · Preflight und NC-Ausgabe verwenden dieselbe kanonische Motion-Wahrheit )',`( ${enabled.length} Bearbeitungen )`,'G21','G90','G17','( 004T-A Initial Safe Entry · unbekannte Maschinen-XY-Position )'];
  lines.push(`G0 Z${f3(firstStart.z)}`);
  lines.push(`G0 X${f3(firstStart.x)} Y${f3(firstStart.y)}`);
  let toolChangeCount=0;
  let spindleRunning=false;
  let activeSpindleRpm:number|null=null;
  prepared.forEach((item,index)=>{
    const operation=item.operation,toolpath=item.preflight!.toolpath!;
    const spindleRpm=Math.round(operation.spindleRpm);
    lines.push(`( Bearbeitung ${index+1}/${enabled.length} · ${label(operation)} · ${operationDisplayName(operation,index)} )`);
    if(!spindleRunning){
      lines.push(`M3 S${spindleRpm}`);
      spindleRunning=true;
      activeSpindleRpm=spindleRpm;
    }else if(activeSpindleRpm!==spindleRpm){
      lines.push(`S${spindleRpm}`);
      activeSpindleRpm=spindleRpm;
    }
    lines.push(...postCanonicalMachineMotions({motions:toolpath.motions??[],operation}));
    const next=prepared[index+1]?.operation;
    if(!next)return;
    if(toolKey(operation)!==toolKey(next)){
      toolChangeCount++;
      lines.push('M5',`( Werkzeugwechsel ${toolChangeCount} )`,`M0 ( Werkzeug ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm einsetzen und bestaetigen )`);
      spindleRunning=false;
      activeSpindleRpm=null;
    }else lines.push(`( Gleiches Werkzeug · ${next.tool.name} · Ø${f3(next.tool.diameterMm)} mm )`);
    const transition=transitions.transitions.find(t=>t.fromOperationId===operation.id&&t.toOperationId===next.id);
    if(transition?.motions.length)lines.push(...postCanonicalMachineMotions({motions:transition.motions,operation:next}));
  });
  if(spindleRunning)lines.push('M5');
  lines.push('M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings:[...new Set(preflight.warnings)],code,lineCount:lines.length,operationCount:enabled.length,toolChangeCount};
}
