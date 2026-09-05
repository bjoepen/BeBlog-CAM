import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
import { generateClosedContourGcode, type GcodeResult, type InterpolationMode } from './closedContourGcode';
import { generateOpenContourGcode } from './openContourGcode';
import { generateBrokenContourGcode } from './brokenContourGcode';
import { canonicalContourToolpathFromGcode, postContourCanonicalToolpath } from './contourCanonicalToolpath';
import { contourOperationWithResolvedDepth } from './contourDepth';

export type { GcodeResult, InterpolationMode };

type ContourArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation};

function generateLegacyContourGcode(args:ContourArgs):GcodeResult{
  if(args.operation.topology==='open')return generateOpenContourGcode(args);
  if((args.operation.excludedSegmentIds??[]).length)return generateBrokenContourGcode(args);
  return generateClosedContourGcode(args);
}

export function generateContourGcode(args:ContourArgs):GcodeResult{
  const resolved=contourOperationWithResolvedDepth({operation:args.operation,stock:args.stock,stockMode:args.stockMode,wcs:args.wcs});
  if(!resolved.resolution.ok)return{ok:false,errors:resolved.resolution.errors,warnings:resolved.resolution.warnings,code:'',lineCount:0,pointCount:0,passes:0,radiusMm:args.operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0};
  const effectiveArgs={...args,operation:resolved.operation};
  const result=generateLegacyContourGcode(effectiveArgs);
  result.warnings=[...resolved.resolution.warnings,...result.warnings];
  if(!result.ok)return result;

  const canonical=canonicalContourToolpathFromGcode(result.code,args.operation.tool.diameterMm);
  if(!canonical){
    return{...result,ok:false,errors:[...result.errors,'Die geprüfte Konturbahn konnte nicht in den kanonischen Toolpath-Vertrag übernommen werden.'],code:'',lineCount:0};
  }

  const code=postContourCanonicalToolpath(canonical,{safeZMm:args.operation.safeZMm,feedMmMin:args.operation.feedMmMin,plungeMmMin:args.operation.plungeMmMin,spindleRpm:args.operation.spindleRpm});
  return{...result,code,lineCount:code.trimEnd().split(/\r?\n/).length};
}
