import type {
  CanonicalMachineMotion,
  CanonicalSpatialSegment,
  CanonicalToolpath,
  CanonicalToolpathRun,
  ToolpathPoint2,
  ToolpathPoint3,
} from './canonicalToolpath';
import type { CurvedFaceTarget } from './curvedFaceTarget';
import { projectCarveToolpathToSurface } from './surfaceCarveProjection';

export type SurfaceCarveOrigin={x:number;y:number;z:number};

export type SurfaceCarveCanonicalOptions={
  origin:SurfaceCarveOrigin;
  safeZMm:number;
  feedMmMin:number;
  plungeMmMin:number;
  sampleSpacingMm?:number;
};

export type SurfaceCarveCanonicalResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  runCount:number;
  cuttingMotionCount:number;
};

const EPS=1e-9;
const finite=(value:number)=>Number.isFinite(value);
const samePoint=(a:ToolpathPoint3,b:ToolpathPoint3)=>
  Math.abs(a.x-b.x)<=EPS&&Math.abs(a.y-b.y)<=EPS&&Math.abs(a.z-b.z)<=EPS;

function worldPoint(point:ToolpathPoint2,origin:SurfaceCarveOrigin):ToolpathPoint2{
  return{x:point.x+origin.x,y:point.y+origin.y};
}

function worldCarveToolpath(toolpath:CanonicalToolpath,origin:SurfaceCarveOrigin):CanonicalToolpath{
  return{
    ...toolpath,
    motions:undefined,
    runs:toolpath.runs.map(run=>({
      ...run,
      points:run.points.map(point=>worldPoint(point,origin)),
      segments:run.segments?.map(segment=>segment.kind==='line'
        ?{kind:'line' as const,start:worldPoint(segment.start,origin),end:worldPoint(segment.end,origin)}
        :{
          kind:'arc' as const,
          start:worldPoint(segment.start,origin),
          end:worldPoint(segment.end,origin),
          center:worldPoint(segment.center,origin),
          ccw:segment.ccw,
        }),
      cutSegments3:undefined,
      entrySegments:undefined,
      exitSegments:undefined,
    })),
  };
}

function worldToWcs(point:ToolpathPoint3,origin:SurfaceCarveOrigin,relativeDepthMm:number):ToolpathPoint3{
  return{
    x:point.x-origin.x,
    y:point.y-origin.y,
    z:point.z-origin.z+relativeDepthMm,
  };
}

function appendMotion(target:CanonicalMachineMotion[],motion:CanonicalMachineMotion,errors:string[],label:string){
  if(![
    motion.start.x,motion.start.y,motion.start.z,
    motion.end.x,motion.end.y,motion.end.z,
  ].every(finite)){
    errors.push(`${label}: nicht-endliche XYZ-Koordinate.`);
    return;
  }
  const previous=target.at(-1);
  if(previous&&!samePoint(previous.end,motion.start))errors.push(`${label}: Bewegungskette ist nicht zusammenhängend.`);
  target.push(motion);
}

export function buildSurfaceCarveCanonicalToolpath(
  planarCarveToolpath:CanonicalToolpath,
  target:CurvedFaceTarget,
  options:SurfaceCarveCanonicalOptions,
):SurfaceCarveCanonicalResult{
  const errors:string[]=[];
  const warnings:string[]=[];

  // A normal planar Carve is only the normalized 2D source geometry. The
  // machining result below is deliberately a distinct Surface Carve.
  if(planarCarveToolpath.operationKind!=='carve')errors.push('Surface Carve erwartet eine vorhandene kanonische 2D-Carve-Quellgeometrie.');
  if(!target.valid)errors.push(...target.errors.map(error=>`STEP-Fläche: ${error}`));
  if(!finite(options.safeZMm))errors.push('Sicherheits-Z muss endlich sein.');
  if(!(options.feedMmMin>0&&finite(options.feedMmMin)))errors.push('Vorschub muss größer als 0 sein.');
  if(!(options.plungeMmMin>0&&finite(options.plungeMmMin)))errors.push('Eintauchvorschub muss größer als 0 sein.');
  if(errors.length)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings,runCount:0,cuttingMotionCount:0};

  const worldToolpath=worldCarveToolpath(planarCarveToolpath,options.origin);
  const projected=projectCarveToolpathToSurface(worldToolpath,target,{sampleSpacingMm:options.sampleSpacingMm});
  errors.push(...projected.errors);
  warnings.push(...projected.warnings);
  if(!projected.ok)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],runCount:0,cuttingMotionCount:0};

  const runs:CanonicalToolpathRun[]=[];
  const motions:CanonicalMachineMotion[]=[];
  let previousSafe:ToolpathPoint3|null=null;
  let cuttingMotionCount=0;

  for(const projectedRun of projected.runs){
    const sourceRun=planarCarveToolpath.runs[projectedRun.sourceRunIndex];
    if(!sourceRun){errors.push(`Projizierter Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} besitzt keinen Quelllauf.`);continue;}
    if(projectedRun.points.length<2){warnings.push(`Projizierter Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} enthält weniger als zwei Punkte.`);continue;}

    const relativeDepthMm=sourceRun.z;
    if(!finite(relativeDepthMm)||relativeDepthMm>EPS){
      errors.push(`Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1}: relative Schnitttiefe ${relativeDepthMm} mm ist ungültig.`);
      continue;
    }

    const points3=projectedRun.points.map(point=>worldToWcs(point,options.origin,relativeDepthMm));
    const cutSegments3:CanonicalSpatialSegment[]=[];
    for(let index=1;index<points3.length;index++){
      cutSegments3.push({kind:'line3',start:points3[index-1],end:points3[index],feedMmMin:options.feedMmMin});
    }
    if(!cutSegments3.length)continue;

    const start=points3[0],end=points3.at(-1)!;
    const startSafe:ToolpathPoint3={x:start.x,y:start.y,z:options.safeZMm};
    const endSafe:ToolpathPoint3={x:end.x,y:end.y,z:options.safeZMm};

    if(previousSafe&&!samePoint(previousSafe,startSafe)){
      appendMotion(motions,{kind:'rapid3',start:previousSafe,end:startSafe},errors,`Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} XY-Rapid`);
    }
    appendMotion(motions,{kind:'line3',start:startSafe,end:start,feedMmMin:options.plungeMmMin},errors,`Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} Zustellung`);
    for(const [index,segment] of cutSegments3.entries()){
      appendMotion(motions,segment,errors,`Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} Schnitt ${index+1}`);
      cuttingMotionCount++;
    }
    appendMotion(motions,{kind:'rapid3',start:end,end:endSafe},errors,`Surface-Carve-Lauf ${projectedRun.sourceRunIndex+1} Sicherheits-Retract`);
    previousSafe=endSafe;

    runs.push({
      kind:'cut',
      z:start.z,
      points:points3.map(point=>({x:point.x,y:point.y})),
      cutSegments3,
      retractAfter:true,
    });
  }

  if(!runs.length&&!errors.length)errors.push('Surface Carve konnte keine surface-following Schnittbahn erzeugen.');
  if(motions.length&&Math.abs(motions[0].start.z-options.safeZMm)>EPS)errors.push('Surface-Carve-Motions beginnen nicht auf Sicherheits-Z.');
  if(motions.length&&Math.abs(motions.at(-1)!.end.z-options.safeZMm)>EPS)errors.push('Surface-Carve-Motions enden nicht auf Sicherheits-Z.');

  if(errors.length)return{ok:false,toolpath:null,errors:[...new Set(errors)],warnings:[...new Set(warnings)],runCount:runs.length,cuttingMotionCount};

  return{
    ok:true,
    toolpath:{
      version:1,
      operationKind:'surface-carve',
      strategy:'surface-carve',
      tool:{diameterMm:planarCarveToolpath.tool.diameterMm},
      stepoverPercent:0,
      runs,
      motions,
      sourceOperationId:planarCarveToolpath.sourceOperationId,
      targetKey:planarCarveToolpath.targetKey,
    },
    errors:[],
    warnings:[...new Set(warnings)],
    runCount:runs.length,
    cuttingMotionCount,
  };
}
