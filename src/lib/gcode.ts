import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation } from './types';
import { generateClosedContourGcode, type GcodeResult, type InterpolationMode } from './closedContourGcode';
import { generateOpenContourGcode } from './openContourGcode';

export type { GcodeResult, InterpolationMode };

export function generateContourGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation}):GcodeResult{
  return args.operation.topology==='open'
    ? generateOpenContourGcode(args)
    : generateClosedContourGcode(args);
}
