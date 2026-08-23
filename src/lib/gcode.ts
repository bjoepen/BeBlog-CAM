import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
import { generateClosedContourGcode, type GcodeResult, type InterpolationMode } from './closedContourGcode';
import { generateOpenContourGcode } from './openContourGcode';
import { generateBrokenContourGcode } from './brokenContourGcode';

export type { GcodeResult, InterpolationMode };

export function generateContourGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation}):GcodeResult{
  // 001Y keeps one Contour operation: native open DXF, broken closed CAD contour,
  // or the proven fully closed contour core.
  if(args.operation.topology==='open')return generateOpenContourGcode(args);
  if((args.operation.excludedSegmentIds??[]).length)return generateBrokenContourGcode(args);
  return generateClosedContourGcode(args);
}
