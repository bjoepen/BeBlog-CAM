import type { CanonicalToolpath } from './canonicalToolpath';
import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
import { generateClosedContourGcode, type GcodeResult, type InterpolationMode } from './closedContourGcode';
import { generateOpenContourGcode } from './openContourGcode';
import { generateBrokenContourGcode } from './brokenContourGcode';
import { canonicalContourToolpathFromGcode, postContourCanonicalToolpath } from './contourCanonicalToolpath';
import { contourOperationWithResolvedDepth } from './contourDepth';
import { applyContourFinishing } from './contourFinishing';
import { applyStepContourTabs } from './stepContourTabs';
import { applyContourLeads } from './contourLeads';
export type { GcodeResult, InterpolationMode };
type ContourArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation};
export type DxfContourCanonicalState={ok:boolean;errors:string[];warnings:string[];toolpath:CanonicalToolpath|null;legacy:GcodeResult|null};
function emptyResult(args:ContourArgs,errors:string[],warnings:string[]):GcodeResult{return{ok:false,errors,warnings,code:'',lineCount:0,pointCount:0,passes:0,radiusMm:args.operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0};}
function generateLegacyContourGcode(args:ContourArgs):GcodeResult{if(args.operation.topology==='open')return generateOpenContourGcode(args);if((args.operation.excludedSegmentIds??[]).length)return generateBrokenContourGcode(args);return generateClosedContourGcode(args);}

export function buildDxfContourCanonicalState(args:ContourArgs):DxfContourCanonicalState{
  const resolved=contourOperationWithResolvedDepth({operation:args.operation,stock:args.stock,stockMode:args.stockMode,wcs:args.wcs});
  if(!resolved.resolution.ok)return{ok:false,errors:[...resolved.resolution.errors],warnings:[...resolved.resolution.warnings],toolpath:null,legacy:null};
  const effectiveArgs={...args,operation:resolved.operation};
  const legacy=generateLegacyContourGcode(effectiveArgs);
  const warnings=[...resolved.resolution.warnings,...legacy.warnings];
  if(!legacy.ok)return{ok:false,errors:[...legacy.errors],warnings,toolpath:null,legacy};
  const canonical=canonicalContourToolpathFromGcode(legacy.code,args.operation.tool.diameterMm);
  if(!canonical)return{ok:false,errors:[...legacy.errors,'Die geprüfte Konturbahn konnte nicht in den kanonischen Toolpath-Vertrag übernommen werden.'],warnings,toolpath:null,legacy};
  const finished=applyContourFinishing(canonical,args.operation,resolved.resolution.depthMm);
  warnings.push(...finished.warnings);
  if(finished.errors.length)return{ok:false,errors:[...legacy.errors,...finished.errors],warnings,toolpath:null,legacy};
  // 004Z-F1: leads are resolved on the logical contour passage first. Tabs then
  // alter only the cutting Z inside that same passage, exactly like STEP.
  const led=applyContourLeads(finished.toolpath,args.operation);
  warnings.push(...led.warnings);
  if(led.errors.length)return{ok:false,errors:[...legacy.errors,...led.errors],warnings,toolpath:null,legacy};
  const tabbed=applyStepContourTabs(led.toolpath,args.operation,0);
  warnings.push(...tabbed.warnings);
  if(tabbed.errors.length)return{ok:false,errors:[...legacy.errors,...tabbed.errors],warnings,toolpath:null,legacy};
  return{ok:true,errors:[],warnings,toolpath:tabbed.toolpath,legacy};
}

export function generateContourGcode(args:ContourArgs):GcodeResult{
  const state=buildDxfContourCanonicalState(args);
  if(!state.ok||!state.toolpath){
    if(state.legacy)return{...state.legacy,ok:false,errors:state.errors,warnings:state.warnings,code:'',lineCount:0};
    return emptyResult(args,state.errors,state.warnings);
  }
  const code=postContourCanonicalToolpath(state.toolpath,{safeZMm:args.operation.safeZMm,feedMmMin:args.operation.feedMmMin,plungeMmMin:args.operation.plungeMmMin,spindleRpm:args.operation.spindleRpm});
  return{...state.legacy!,ok:true,errors:[],warnings:state.warnings,code,lineCount:code.trimEnd().split(/\r?\n/).length};
}
