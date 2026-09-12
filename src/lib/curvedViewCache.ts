import type { PartOrientation, PartPlacement, StockDefinition, ZLevelRoughingOperation } from './types';
import type { P3 } from './stepView';
import { buildCurvedFaceTarget, curvedFaceTargetZAt } from './curvedFaceTarget';
import { buildCurvedFaceRoughing } from './curvedFaceRoughing';
import { buildSurfaceCarveViewProof } from './surfaceCarveViewProof';

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

export function cachedCurvedViewSamples(ctx:Context,target:Target,selectedFaceIds:number[]){
  const key=baseKey(ctx,selectedFaceIds)+'|samples24|surface-carve-view-proof';
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
    const proof=buildSurfaceCarveViewProof(target);
    if(proof.ok)out.push(...proof.paths);
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
