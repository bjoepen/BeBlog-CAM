import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
import { generateClosedContourGcode, type GcodeResult, type InterpolationMode } from './closedContourGcode';
import { generateOpenContourGcode } from './openContourGcode';
import { generateBrokenContourGcode } from './brokenContourGcode';
import { canonicalContourToolpathFromGcode, postContourCanonicalToolpath } from './contourCanonicalToolpath';

export type { GcodeResult, InterpolationMode };

type ContourArgs={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation};

function generateLegacyContourGcode(args:ContourArgs):GcodeResult{
  if(args.operation.topology==='open')return generateOpenContourGcode(args);
  if((args.operation.excludedSegmentIds??[]).length)return generateBrokenContourGcode(args);
  return generateClosedContourGcode(args);
}

export function generateContourGcode(args:ContourArgs):GcodeResult{
  // 001Z-A keeps the proven contour geometry generators as the source of validated
  // contour motion, normalises that motion into the canonical toolpath contract,
  // then serialises the machine program from that canonical representation.
  const result=generateLegacyContourGcode(args);
  if(!result.ok)return result;

  const canonical=canonicalContourToolpathFromGcode(result.code,args.operation.tool.diameterMm);
  if(!canonical){
    return{
      ...result,
      ok:false,
      errors:[...result.errors,'Die geprüfte Konturbahn konnte nicht in den kanonischen Toolpath-Vertrag übernommen werden.'],
      code:'',
      lineCount:0,
    };
  }

  const code=postContourCanonicalToolpath(canonical,{
    safeZMm:args.operation.safeZMm,
    feedMmMin:args.operation.feedMmMin,
    plungeMmMin:args.operation.plungeMmMin,
    spindleRpm:args.operation.spindleRpm,
  });

  return{...result,code,lineCount:code.trimEnd().split(/\r?\n/).length};
}
