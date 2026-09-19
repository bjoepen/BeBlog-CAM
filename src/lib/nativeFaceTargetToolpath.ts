import type { CanonicalToolpath } from './canonicalToolpath';
import { buildModelRoughingCanonicalToolpath } from './modelRoughingToolpath';
import type { RoughingRegion } from './roughingRegion';
import type { NativeZLevelRegionSet, StockDefinition, WorkCoordinateSystem, ZLevelRoughingOperation } from './types';

export type NativeFaceTargetCanonicalResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
};

function origin(stock:StockDefinition,wcs:WorkCoordinateSystem){
  return{
    x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,
    y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,
    z:wcs.z==='top'?stock.thickness:0,
  };
}

function regionsFromNative(native:NativeZLevelRegionSet,stock:StockDefinition):RoughingRegion[]{
  const stockRect={minX:0,minY:0,maxX:stock.width,maxY:stock.height};
  return native.regions.map(region=>({
    z:region.z,
    valid:region.valid,
    stock:stockRect,
    islands:region.islands.map(island=>({
      outer:island.outer.map(point=>({...point})),
      holes:island.holes.map(hole=>hole.map(point=>({...point}))),
      source:'model-void' as const,
      depth:0,
    })),
    modelLoopCount:0,
    errors:[...region.errors],
    warnings:[...region.warnings],
  }));
}

/**
 * 008H-N3 production boundary.
 * Native OCCT owns Face-target material geometry. TypeScript only rasterises
 * the already-proven planar regions; it must not infer Face ownership.
 */
export function buildNativeFaceTargetCanonicalToolpath(args:{
  native:NativeZLevelRegionSet;
  stock:StockDefinition;
  wcs:WorkCoordinateSystem;
  operation:ZLevelRoughingOperation;
}):NativeFaceTargetCanonicalResult{
  const {native,stock,wcs,operation}=args;
  const errors=[...native.errors];
  const warnings=[...native.warnings];
  if(wcs.z!=='top')errors.push('Native Face Target benötigt WCS Z auf der Rohlingoberseite.');
  for(const region of native.regions){
    warnings.push(...region.warnings.map(message=>`Z=${region.z.toFixed(3)} mm: ${message}`));
    if(!region.valid){
      if(region.errors.length)errors.push(...region.errors.map(message=>`Z=${region.z.toFixed(3)} mm: ${message}`));
      else errors.push(`Z=${region.z.toFixed(3)} mm: Native Face-Target-Region ist ungültig und enthält keine konkrete OCCT-Ursache.`);
    }
  }
  if(errors.length)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};

  const regions=regionsFromNative(native,stock);
  const build=(direction:'x'|'y')=>buildModelRoughingCanonicalToolpath(
    regions,
    operation.tool.diameterMm,
    operation.stepoverPercent,
    origin(stock,wcs),
    undefined,
    Math.max(0,operation.finishAllowanceMm),
    direction,
  );
  const requested=operation.rasterDirection??'auto';
  const candidates=requested==='auto'?[build('x'),build('y')]:[build(requested)];
  const valid=candidates.filter(candidate=>candidate.ok&&candidate.toolpath);
  if(!valid.length){
    for(const candidate of candidates){errors.push(...candidate.errors);warnings.push(...candidate.warnings)}
    return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  }
  const length=(toolpath:CanonicalToolpath)=>toolpath.runs.reduce((sum,run)=>sum+run.points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-run.points[i].x,p.y-run.points[i].y),0),0);
  valid.sort((a,b)=>{
    const ar=a.toolpath!.runs.length,br=b.toolpath!.runs.length;
    if(ar!==br)return ar-br;
    return length(b.toolpath!)/Math.max(1,br)-length(a.toolpath!)/Math.max(1,ar);
  });
  const chosen=valid[0];
  warnings.push(...chosen.warnings);
  warnings.push('008H-N3: Werkzeugbahn stammt ausschließlich aus der nativen OCCT Face-Target-Materialregion.');
  return{ok:true,toolpath:chosen.toolpath,errors:[],warnings:[...new Set(warnings)]};
}
