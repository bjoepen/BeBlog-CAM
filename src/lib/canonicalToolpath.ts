export type ToolpathPoint2={x:number;y:number};
export type ToolpathPoint3={x:number;y:number;z:number};

export type CanonicalToolpathSegment=
  |{kind:'line';start:ToolpathPoint2;end:ToolpathPoint2}
  |{kind:'arc';start:ToolpathPoint2;end:ToolpathPoint2;center:ToolpathPoint2;ccw:boolean};

export type CanonicalSpatialSegment=
  |{kind:'line3';start:ToolpathPoint3;end:ToolpathPoint3;feedMmMin?:number}
  |{kind:'arc3';start:ToolpathPoint3;end:ToolpathPoint3;center:ToolpathPoint2;ccw:boolean;feedMmMin?:number};

export type CanonicalToolpathRun={
  kind:'cut';
  z:number;
  points:ToolpathPoint2[];
  segments?:CanonicalToolpathSegment[];
  entrySegments?:CanonicalSpatialSegment[];
  retractAfter?:boolean;
};

export type CanonicalToolpath={
  version:1;
  operationKind:'z-level-roughing'|'facing'|'contour'|'pocket'|'carve';
  strategy:'raster'|'zigzag'|'contour'|'concentric'|'parallel-pocket'|'carve';
  tool:{diameterMm:number};
  stepoverPercent:number;
  runs:CanonicalToolpathRun[];
};

export function canonicalToolpathRunCount(toolpath:CanonicalToolpath|null|undefined):number{
  return toolpath?.runs.length??0;
}
