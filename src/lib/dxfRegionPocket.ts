import { buildClosedChains } from './contourMath';
import { resolvePlanarPartTransform } from './partTransform';
import { buildRegionPocketToolpath } from './regionPocketToolpath';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export function buildDxfRegionPocket(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation;strategy:'concentric'|'parallel'}):{toolpath:CanonicalToolpath|null;errors:string[];warnings:string[]}{
  const {summary,stock,stockMode,placement,orientation,wcs,operation,strategy}=args;
  if(summary.kind!=='dxf')return{toolpath:null,errors:['DXF-Regionstasche benötigt DXF-Geometrie.'],warnings:[]};
  if(operation.contourId==null)return{toolpath:null,errors:['Keine geschlossene DXF-Taschenkontur gewählt.'],warnings:[]};
  const transform=resolvePlanarPartTransform({summary,stock,stockMode,placement,orientation});
  if(!transform)return{toolpath:null,errors:['DXF-Taschengeometrie konnte nicht transformiert werden.'],warnings:[]};
  const chains=buildClosedChains(summary.planarGeometry?.curves??[],p=>transform.toWcs(p,wcs));
  const selected=chains.find(chain=>chain.id===operation.contourId)??null;
  if(!selected)return{toolpath:null,errors:['Gewählte DXF-Taschenkontur wurde nicht gefunden.'],warnings:[]};
  return buildRegionPocketToolpath({outer:selected.points,islands:[],operation,targetDepthMm:operation.totalDepthMm,strategy});
}
