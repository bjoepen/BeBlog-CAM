export type ToolpathPoint2={x:number;y:number};

export type CanonicalToolpathRun={
  kind:'cut';
  z:number;
  points:ToolpathPoint2[];
};

export type CanonicalToolpath={
  version:1;
  operationKind:'z-level-roughing'|'facing';
  strategy:'raster'|'zigzag';
  tool:{diameterMm:number};
  stepoverPercent:number;
  runs:CanonicalToolpathRun[];
};

export function canonicalToolpathRunCount(toolpath:CanonicalToolpath|null|undefined):number{
  return toolpath?.runs.length??0;
}
