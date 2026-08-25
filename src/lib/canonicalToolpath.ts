export type ToolpathPoint2={x:number;y:number};

export type CanonicalToolpathSegment=
  |{kind:'line';start:ToolpathPoint2;end:ToolpathPoint2}
  |{kind:'arc';start:ToolpathPoint2;end:ToolpathPoint2;center:ToolpathPoint2;ccw:boolean};

export type CanonicalToolpathRun={
  kind:'cut';
  z:number;
  points:ToolpathPoint2[];
  segments?:CanonicalToolpathSegment[];
};

export type CanonicalToolpath={
  version:1;
  operationKind:'z-level-roughing'|'facing'|'contour'|'pocket';
  strategy:'raster'|'zigzag'|'contour'|'concentric'|'parallel-pocket';
  tool:{diameterMm:number};
  stepoverPercent:number;
  runs:CanonicalToolpathRun[];
};

export function canonicalToolpathRunCount(toolpath:CanonicalToolpath|null|undefined):number{
  return toolpath?.runs.length??0;
}
