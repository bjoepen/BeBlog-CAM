import type { CamOperation, ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import { generateFacingGcode } from './facingGcode';
import { generateContourGcode } from './gcode';
import { generatePocketGcode } from './pocketGcode';
import { validateCarveOperation } from './carveMath';
import { validateDrillOperation } from './drillGcode';
import { validateOperationGrammar } from './validationGrammar';
import { validateCanonicalToolpath } from './canonicalPreflight';
import { buildFacingToolpath } from './facingToolpath';
import { canonicalContourToolpathFromGcode } from './contourCanonicalToolpath';
import { buildPocketCanonicalToolpath } from './pocketCanonicalToolpath';
import { buildCarveCanonicalToolpath } from './carveCanonicalToolpath';
import { buildDrillCanonicalToolpath } from './drillCanonicalToolpath';

export type JobPreflightLevel='pass'|'warn'|'fail';
export type JobPreflightOperation={id:string;index:number;kind:CamOperation['kind'];label:string;detail:string;canonical:string;level:JobPreflightLevel;errors:string[];warnings:string[]};
export type JobPreflightResult={level:JobPreflightLevel;operations:JobPreflightOperation[];enabledCount:number;toolChanges:number;errors:string[];warnings:string[]};

const kindLabel=(kind:CamOperation['kind'])=>kind==='facing'?'Planen':kind==='contour'?'Kontur':kind==='pocket'?'Tasche':kind==='carve'?'Carve':'Bohren';
const toolKey=(op:CamOperation)=>`${op.tool.name}|${op.tool.diameterMm.toFixed(6)}`;
const unique=(items:string[])=>[...new Set(items)];

export function validateJob(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operations:CamOperation[]}):JobPreflightResult{
  const {summary,stock,stockMode,placement,orientation,wcs}=args;
  const enabled=args.operations.filter(op=>op.enabled!==false);
  const operations:JobPreflightOperation[]=[];const errors:string[]=[];const warnings:string[]=[];
  enabled.forEach((operation,index)=>{
    let opErrors:string[]=[];let opWarnings:string[]=[];let detail='';let canonicalToolpath=null;
    if(operation.kind==='facing'){
      const r=generateFacingGcode({stock,stockMode,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`${operation.direction==='x'?'X-Raster':'Y-Raster'} · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm Abtrag`;
      if(r.ok)canonicalToolpath=buildFacingToolpath({stock,wcs,operation}).toolpath;
    }else if(operation.kind==='carve'){
      const r=validateCarveOperation(summary,operation);opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`${r.segments.length} Linien · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
      if(!opErrors.length)canonicalToolpath=buildCarveCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
    }else if(operation.kind==='drill'){
      const r=validateDrillOperation(summary,operation);opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`${operation.method==='helical-mill'?'Helixfräsen':'Bohren'} · ${r.holeCount} Position${r.holeCount===1?'':'en'} · Werkzeug Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
      if(!opErrors.length)canonicalToolpath=buildDrillCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
    }else if(operation.kind==='pocket'){
      const r=generatePocketGcode({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];detail=`Tasche · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
      if(r.ok)canonicalToolpath=buildPocketCanonicalToolpath({summary,stock,stockMode,placement,orientation,wcs,operation});
    }else{
      const r=generateContourGcode({summary,stock,stockMode,placement,orientation,wcs,operation});opErrors=[...r.errors];opWarnings=[...r.warnings];
      const excluded=operation.excludedSegmentIds??[];
      const topology=operation.topology==='open'?'offene DXF-Kontur':excluded.length?`aufgebrochen · ${excluded.length} Strecke${excluded.length===1?'':'n'} aus`:'geschlossen';
      const side=operation.topology==='open'?(operation.openSide==='left'?'Links':operation.openSide==='right'?'Rechts':'Auf Linie'):(operation.side==='outside'?'Außen':operation.side==='inside'?'Innen':'Auf Linie');
      detail=`${topology} · ${side} · Ø ${operation.tool.diameterMm.toFixed(3)} mm · ${operation.totalDepthMm.toFixed(3)} mm tief`;
      if(r.ok)canonicalToolpath=canonicalContourToolpathFromGcode(r.code,operation.tool.diameterMm);
    }

    for(const check of validateOperationGrammar(operation,stock,stockMode,wcs)){
      if(check.level==='fail')opErrors.push(`${check.title}: ${check.detail}`);
      else if(check.level==='warn')opWarnings.push(`${check.title}: ${check.detail}`);
    }

    const canonical=validateCanonicalToolpath(canonicalToolpath);
    if(!opErrors.length){
      opErrors.push(...canonical.errors.map(message=>`Kanonischer Werkzeugweg: ${message}`));
      opWarnings.push(...canonical.warnings.map(message=>`Kanonischer Werkzeugweg: ${message}`));
    }
    opErrors=unique(opErrors);opWarnings=unique(opWarnings);

    const level:JobPreflightLevel=opErrors.length?'fail':opWarnings.length?'warn':'pass';
    const label=operation.name||kindLabel(operation.kind);operations.push({id:operation.id,index:index+1,kind:operation.kind,label,detail,canonical:canonical.summary,level,errors:opErrors,warnings:opWarnings});
    errors.push(...opErrors.map(e=>`Bearbeitung ${index+1} (${kindLabel(operation.kind)}): ${e}`));warnings.push(...opWarnings.map(w=>`Bearbeitung ${index+1} (${kindLabel(operation.kind)}): ${w}`));
  });
  if(!enabled.length)errors.push('Der Gesamtjob enthält keine aktivierte Bearbeitung.');
  let toolChanges=0;for(let i=1;i<enabled.length;i++)if(toolKey(enabled[i])!==toolKey(enabled[i-1]))toolChanges++;
  const level:JobPreflightLevel=errors.length?'fail':warnings.length?'warn':'pass';
  return{level,operations,enabledCount:enabled.length,toolChanges,errors,warnings};
}
