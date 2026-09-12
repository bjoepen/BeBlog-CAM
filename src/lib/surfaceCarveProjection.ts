import type { CanonicalToolpath, CanonicalToolpathSegment, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import { curvedFaceTargetZAt, type CurvedFaceTarget } from './curvedFaceTarget';

export type SurfaceCarvePreviewRun={
  sourceRunIndex:number;
  points:ToolpathPoint3[];
};

export type SurfaceCarveProjectionResult={
  ok:boolean;
  runs:SurfaceCarvePreviewRun[];
  errors:string[];
  warnings:string[];
};

export type SurfaceCarveProjectionOptions={
  sampleSpacingMm?:number;
};

const DEFAULT_SAMPLE_SPACING_MM=0.5;
const EPS=1e-9;

function lineSamples(start:ToolpathPoint2,end:ToolpathPoint2,spacing:number):ToolpathPoint2[]{
  const dx=end.x-start.x,dy=end.y-start.y;
  const length=Math.hypot(dx,dy);
  const steps=Math.max(1,Math.ceil(length/spacing));
  return Array.from({length:steps+1},(_,index)=>{
    const t=index/steps;
    return{x:start.x+dx*t,y:start.y+dy*t};
  });
}

function arcSamples(segment:Extract<CanonicalToolpathSegment,{kind:'arc'}>,spacing:number):ToolpathPoint2[]{
  const {start,end,center,ccw}=segment;
  const radius=Math.hypot(start.x-center.x,start.y-center.y);
  if(radius<=EPS)return[start,end];
  const startAngle=Math.atan2(start.y-center.y,start.x-center.x);
  const endAngle=Math.atan2(end.y-center.y,end.x-center.x);
  let sweep=endAngle-startAngle;
  if(ccw&&sweep<=0)sweep+=Math.PI*2;
  if(!ccw&&sweep>=0)sweep-=Math.PI*2;
  const length=Math.abs(sweep)*radius;
  const steps=Math.max(1,Math.ceil(length/spacing));
  return Array.from({length:steps+1},(_,index)=>{
    const angle=startAngle+sweep*(index/steps);
    return{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
  });
}

function samplesForSegment(segment:CanonicalToolpathSegment,spacing:number){
  return segment.kind==='line'
    ?lineSamples(segment.start,segment.end,spacing)
    :arcSamples(segment,spacing);
}

function projectPoint(target:CurvedFaceTarget,point:ToolpathPoint2):ToolpathPoint3|null{
  const z=curvedFaceTargetZAt(target,point.x,point.y);
  return z===null?null:{x:point.x,y:point.y,z};
}

export function projectCarveToolpathToSurface(
  toolpath:CanonicalToolpath,
  target:CurvedFaceTarget,
  options:SurfaceCarveProjectionOptions={},
):SurfaceCarveProjectionResult{
  const errors:string[]=[];
  const warnings:string[]=[];
  const runs:SurfaceCarvePreviewRun[]=[];
  const sampleSpacingMm=Number.isFinite(options.sampleSpacingMm)&&Number(options.sampleSpacingMm)>0
    ?Number(options.sampleSpacingMm)
    :DEFAULT_SAMPLE_SPACING_MM;

  if(toolpath.operationKind!=='carve')errors.push('Surface-Carve-Projektion erwartet eine vorhandene Carve-Geometrie.');
  if(!target.valid)errors.push(...target.errors.map(error=>`STEP-Fläche: ${error}`));
  if(errors.length)return{ok:false,runs:[],errors:[...new Set(errors)],warnings};

  toolpath.runs.forEach((run,runIndex)=>{
    const segments=run.segments??[];
    if(!segments.length){
      warnings.push(`Carve-Lauf ${runIndex+1} enthält keine projizierbaren Segmente.`);
      return;
    }

    const projected:ToolpathPoint3[]=[];
    for(const segment of segments){
      const samples=samplesForSegment(segment,sampleSpacingMm);
      for(let sampleIndex=0;sampleIndex<samples.length;sampleIndex++){
        if(projected.length&&sampleIndex===0)continue;
        const source=samples[sampleIndex];
        const point=projectPoint(target,source);
        if(!point){
          errors.push(`Carve-Lauf ${runIndex+1} verlässt die ausgewählte STEP-Fläche bei X ${source.x.toFixed(3)} / Y ${source.y.toFixed(3)} mm.`);
          break;
        }
        projected.push(point);
      }
      if(errors.length)break;
    }

    if(projected.length>1)runs.push({sourceRunIndex:runIndex,points:projected});
  });

  if(errors.length)return{ok:false,runs:[],errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  if(!runs.length)errors.push('Keine projizierbare Carve-Geometrie vorhanden.');

  return{
    ok:errors.length===0,
    runs:errors.length?[]:runs,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
  };
}
