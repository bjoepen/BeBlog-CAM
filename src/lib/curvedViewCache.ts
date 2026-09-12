import type { PartOrientation, PartPlacement, StockDefinition, ZLevelRoughingOperation } from './types';
import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import type { P3 } from './stepView';
import { buildCurvedFaceTarget, curvedFaceTargetZAt } from './curvedFaceTarget';
import { buildCurvedFaceRoughing } from './curvedFaceRoughing';
import { projectCarveToolpathToSurface } from './surfaceCarveProjection';

type Target=ReturnType<typeof buildCurvedFaceTarget>;
type Roughing=ReturnType<typeof buildCurvedFaceRoughing>;

type Context={
  fileName:string;
  vertexCount:number;
  orientation:PartOrientation;
  placement:PartPlacement;
  stock:StockDefinition;
};

const n=(value:number)=>Number.isFinite(value)?value.toFixed(5):'nan';
const baseKey=(ctx:Context,faceIds:number[])=>[
  ctx.fileName,ctx.vertexCount,
  n(ctx.orientation.rotationXDeg),n(ctx.orientation.rotationYDeg),n(ctx.orientation.rotationZDeg),
  ctx.placement.horizontal,ctx.placement.vertical,n(ctx.placement.offsetX),n(ctx.placement.offsetY),n(ctx.placement.offsetZ),
  n(ctx.stock.width),n(ctx.stock.height),n(ctx.stock.thickness),
  [...faceIds].sort((a,b)=>a-b).join(','),
].join('|');

let targetKey='';
let targetValue:Target|null=null;
let sampleKey='';
let sampleValue:P3[][]=[];
let roughingKey='';
let roughingValue:Roughing|null=null;

export const curvedViewCacheStats={targetBuilds:0,sampleBuilds:0,roughingBuilds:0};

export function cachedCurvedViewTarget(ctx:Context,part:P3[],displayFaceIds:number[],selectedFaceIds:number[]){
  const key=baseKey(ctx,selectedFaceIds);
  if(key!==targetKey){
    targetKey=key;
    targetValue=buildCurvedFaceTarget(part,displayFaceIds,selectedFaceIds);
    sampleKey='';roughingKey='';
    curvedViewCacheStats.targetBuilds++;
  }
  return targetValue;
}

function surfaceCarveDiagnosticToolpath(target:Target):CanonicalToolpath|null{
  if(!target.valid||!target.bounds)return null;
  const b=target.bounds;
  const width=b.maxX-b.minX,height=b.maxY-b.minY;
  if(width<=1e-6||height<=1e-6)return null;
  const insetX=width*.24,insetY=height*.24;
  const left=b.minX+insetX,right=b.maxX-insetX,bottom=b.minY+insetY,top=b.maxY-insetY;
  const midX=(left+right)/2,midY=(bottom+top)/2;
  const points:ToolpathPoint2[]=[
    {x:left,y:top},
    {x:midX,y:bottom},
    {x:right,y:top},
    {x:left,y:midY},
    {x:right,y:midY},
  ];
  const segments:CanonicalToolpathSegment[]=points.slice(1).map((end,index)=>({kind:'line',start:points[index],end}));
  return{
    version:1,
    operationKind:'carve',
    strategy:'surface-carve-007a-proof',
    tool:{diameterMm:1},
    stepoverPercent:0,
    runs:[{kind:'cut',z:0,points,segments,retractAfter:true}],
  };
}

export function cachedCurvedViewSamples(ctx:Context,target:Target,selectedFaceIds:number[]){
  const key=baseKey(ctx,selectedFaceIds)+'|samples24|surface-carve-007a-proof';
  if(key===sampleKey)return sampleValue;
  const out:P3[][]=[];
  if(target?.valid&&target.bounds){
    const b=target.bounds,nx=24,ny=24;
    for(let iy=0;iy<=ny;iy++){
      const y=b.minY+(b.maxY-b.minY)*iy/ny;let row:P3[]=[];
      for(let ix=0;ix<=nx;ix++){
        const x=b.minX+(b.maxX-b.minX)*ix/nx,z=curvedFaceTargetZAt(target,x,y);
        if(z===null){if(row.length>=2)out.push(row);row=[];}else row.push({x,y,z:z+.04});
      }
      if(row.length>=2)out.push(row);
    }
    for(let ix=0;ix<=nx;ix++){
      const x=b.minX+(b.maxX-b.minX)*ix/nx;let column:P3[]=[];
      for(let iy=0;iy<=ny;iy++){
        const y=b.minY+(b.maxY-b.minY)*iy/ny,z=curvedFaceTargetZAt(target,x,y);
        if(z===null){if(column.length>=2)out.push(column);column=[];}else column.push({x,y,z:z+.04});
      }
      if(column.length>=2)out.push(column);
    }

    // 007A visual proof: a deterministic, preview-only Carve motif is routed
    // through the real Surface-Carve projection adapter.  It is deliberately
    // diagnostic geometry: no operation state, Safe Motion or NC is created.
    const diagnostic=surfaceCarveDiagnosticToolpath(target);
    if(diagnostic){
      const projected=projectCarveToolpathToSurface(diagnostic,target,{sampleSpacingMm:.35});
      if(projected.ok){
        for(const run of projected.runs)out.push(run.points.map(point=>({...point,z:point.z+.09})));
      }
    }
  }
  sampleKey=key;sampleValue=out;curvedViewCacheStats.sampleBuilds++;
  return out;
}

export function cachedCurvedViewRoughing(ctx:Context,target:Target,selectedFaceIds:number[],operation:ZLevelRoughingOperation){
  const key=[baseKey(ctx,selectedFaceIds),n(operation.tool.diameterMm),n(operation.stepDownMm),n(operation.stepoverPercent),n(operation.finishAllowanceMm)].join('|');
  if(key!==roughingKey){
    roughingKey=key;
    roughingValue=target?.valid?buildCurvedFaceRoughing(target,ctx.stock.thickness,operation.tool.diameterMm,operation.stepDownMm,operation.stepoverPercent,operation.finishAllowanceMm):null;
    curvedViewCacheStats.roughingBuilds++;
  }
  return roughingValue;
}
