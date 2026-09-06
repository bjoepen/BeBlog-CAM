import type { CanonicalMachineMotion, CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';

export type SafeMotionChainResult={
  ok:boolean;
  errors:string[];
  warnings:string[];
  toolpath:CanonicalToolpath|null;
  motionCount:number;
  rapidCount:number;
  cuttingMotionCount:number;
  startSafePoint:ToolpathPoint3|null;
  endSafePoint:ToolpathPoint3|null;
};

const finitePoint=(p:ToolpathPoint3)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const p3=(p:ToolpathPoint2,z:number):ToolpathPoint3=>({x:p.x,y:p.y,z});
const samePoint=(a:ToolpathPoint3,b:ToolpathPoint3)=>Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9&&Math.abs(a.z-b.z)<1e-9;
const rapid=(start:ToolpathPoint3,end:ToolpathPoint3):CanonicalMachineMotion=>({kind:'rapid3',start,end});
const line=(start:ToolpathPoint3,end:ToolpathPoint3,feedMmMin?:number):CanonicalSpatialSegment=>({kind:'line3',start,end,...(feedMmMin?{feedMmMin}:{})});

function runCutMotions(run:CanonicalToolpathRun):CanonicalMachineMotion[]{
  if(run.segments?.length){
    return run.segments.map(segment=>segment.kind==='line'
      ?line(p3(segment.start,run.z),p3(segment.end,run.z))
      :({kind:'arc3',start:p3(segment.start,run.z),end:p3(segment.end,run.z),center:segment.center,ccw:segment.ccw}));
  }
  const motions:CanonicalMachineMotion[]=[];
  for(let i=1;i<run.points.length;i++)motions.push(line(p3(run.points[i-1],run.z),p3(run.points[i],run.z)));
  return motions;
}

function appendConnected(target:CanonicalMachineMotion[],motion:CanonicalMachineMotion,errors:string[],label:string){
  if(!finitePoint(motion.start)||!finitePoint(motion.end)){errors.push(`${label}: nicht-endliche XYZ-Koordinate.`);return;}
  const previous=target.at(-1);
  if(previous&&!samePoint(previous.end,motion.start))errors.push(`${label}: Bewegungskette ist nicht zusammenhängend.`);
  target.push(motion);
}

export function materializeSafeMotionChain(args:{toolpath:CanonicalToolpath;safeZMm:number}):SafeMotionChainResult{
  const {toolpath,safeZMm}=args,errors:string[]=[],warnings:string[]=[];
  if(!Number.isFinite(safeZMm))return{ok:false,errors:['004T benötigt einen endlichen Sicherheits-Z-Wert.'],warnings,toolpath:null,motionCount:0,rapidCount:0,cuttingMotionCount:0,startSafePoint:null,endSafePoint:null};

  if(toolpath.motions?.length){
    const motions=[...toolpath.motions];
    for(let i=0;i<motions.length;i++){
      const motion=motions[i];
      if(!finitePoint(motion.start)||!finitePoint(motion.end))errors.push(`Maschinenbewegung ${i+1}: nicht-endliche XYZ-Koordinate.`);
      if(i>0&&!samePoint(motions[i-1].end,motion.start))errors.push(`Maschinenbewegung ${i+1}: explizite canonical motions-Kette ist nicht zusammenhängend.`);
    }
    const first=motions[0]?.start??null,last=motions.at(-1)?.end??null;
    if(first&&Math.abs(first.z-safeZMm)>1e-9)warnings.push('004T: Explizite motions beginnen nicht auf Sicherheits-Z; der Operationseinstieg muss beim Poster/Job-Linker explizit ergänzt werden.');
    if(last&&Math.abs(last.z-safeZMm)>1e-9)warnings.push('004T: Explizite motions enden nicht auf Sicherheits-Z; der Operationsausstieg muss beim Poster/Job-Linker explizit ergänzt werden.');
    return{ok:errors.length===0,errors,warnings,toolpath:errors.length?null:{...toolpath,motions},motionCount:motions.length,rapidCount:motions.filter(m=>m.kind==='rapid3').length,cuttingMotionCount:motions.filter(m=>m.kind!=='rapid3').length,startSafePoint:first,endSafePoint:last};
  }

  if(!toolpath.runs.length)return{ok:false,errors:['004T kann ohne Runs oder explizite motions keine Bewegungskette materialisieren.'],warnings,toolpath:null,motionCount:0,rapidCount:0,cuttingMotionCount:0,startSafePoint:null,endSafePoint:null};

  const motions:CanonicalMachineMotion[]=[];
  let previousSafe:ToolpathPoint3|null=null;
  for(const [runIndex,run] of toolpath.runs.entries()){
    if(run.points.length<2){errors.push(`Werkzeugbahn ${runIndex+1}: weniger als zwei XY-Punkte.`);continue;}
    const runStart=p3(run.points[0],run.z),runEnd=p3(run.points.at(-1)!,run.z),safeStart={x:runStart.x,y:runStart.y,z:safeZMm},safeEnd={x:runEnd.x,y:runEnd.y,z:safeZMm};

    if(previousSafe&&!samePoint(previousSafe,safeStart))appendConnected(motions,rapid(previousSafe,safeStart),errors,`Werkzeugbahn ${runIndex+1} XY-Rapid`);
    else if(!previousSafe)previousSafe=safeStart;

    const entry=run.entrySegments??[];
    if(entry.length){
      if(!samePoint(previousSafe!,entry[0].start))appendConnected(motions,rapid(previousSafe!,entry[0].start),errors,`Werkzeugbahn ${runIndex+1} Entry-Anfahrt`);
      for(const [index,segment] of entry.entries())appendConnected(motions,segment,errors,`Werkzeugbahn ${runIndex+1} Entry ${index+1}`);
      const entryEnd=entry.at(-1)!.end;
      if(!samePoint(entryEnd,runStart))errors.push(`Werkzeugbahn ${runIndex+1}: Entry endet nicht am Schnittstart.`);
    }else appendConnected(motions,line(previousSafe!,runStart),errors,`Werkzeugbahn ${runIndex+1} Zustellung`);

    for(const [index,motion] of runCutMotions(run).entries())appendConnected(motions,motion,errors,`Werkzeugbahn ${runIndex+1} Schnitt ${index+1}`);
    const currentEnd=motions.at(-1)?.end??runEnd;
    if(!samePoint(currentEnd,runEnd))errors.push(`Werkzeugbahn ${runIndex+1}: Schnittkette endet nicht am Run-Endpunkt.`);

    const exit=run.exitSegments??[];
    if(exit.length){
      for(const [index,segment] of exit.entries())appendConnected(motions,segment,errors,`Werkzeugbahn ${runIndex+1} Exit ${index+1}`);
      const exitEnd=exit.at(-1)!.end;
      if(!samePoint(exitEnd,safeEnd))appendConnected(motions,rapid(exitEnd,safeEnd),errors,`Werkzeugbahn ${runIndex+1} Sicherheits-Retract`);
    }else appendConnected(motions,rapid(runEnd,safeEnd),errors,`Werkzeugbahn ${runIndex+1} Sicherheits-Retract`);
    previousSafe=safeEnd;
  }

  const startSafePoint=motions[0]?.start??previousSafe,endSafePoint=motions.at(-1)?.end??previousSafe;
  if(startSafePoint&&Math.abs(startSafePoint.z-safeZMm)>1e-9)errors.push('004T: materialisierte Bewegungskette beginnt nicht auf Sicherheits-Z.');
  if(endSafePoint&&Math.abs(endSafePoint.z-safeZMm)>1e-9)errors.push('004T: materialisierte Bewegungskette endet nicht auf Sicherheits-Z.');
  const resultToolpath=errors.length?null:{...toolpath,motions};
  return{ok:errors.length===0,errors,warnings,toolpath:resultToolpath,motionCount:motions.length,rapidCount:motions.filter(m=>m.kind==='rapid3').length,cuttingMotionCount:motions.filter(m=>m.kind!=='rapid3').length,startSafePoint,endSafePoint};
}

export type JobSafeTransition={fromOperationId:string;toOperationId:string;motions:CanonicalMachineMotion[]};
export function buildJobSafeTransitions(args:{operations:{id:string;safeZMm:number;toolpath:CanonicalToolpath}[]}):{ok:boolean;errors:string[];transitions:JobSafeTransition[]}{
  const errors:string[]=[],transitions:JobSafeTransition[]=[];
  for(let i=0;i<args.operations.length-1;i++){
    const current=args.operations[i],next=args.operations[i+1];
    const a=materializeSafeMotionChain({toolpath:current.toolpath,safeZMm:current.safeZMm}),b=materializeSafeMotionChain({toolpath:next.toolpath,safeZMm:next.safeZMm});
    if(!a.ok||!a.endSafePoint)errors.push(`Operation ${current.id}: keine freigegebene 004T-Endposition.`);
    if(!b.ok||!b.startSafePoint)errors.push(`Operation ${next.id}: keine freigegebene 004T-Startposition.`);
    if(!a.endSafePoint||!b.startSafePoint)continue;
    const safeZ=Math.max(current.safeZMm,next.safeZMm),motions:CanonicalMachineMotion[]=[];
    const lifted={x:a.endSafePoint.x,y:a.endSafePoint.y,z:safeZ};
    if(!samePoint(a.endSafePoint,lifted))motions.push(rapid(a.endSafePoint,lifted));
    const across={x:b.startSafePoint.x,y:b.startSafePoint.y,z:safeZ};
    if(!samePoint(lifted,across))motions.push(rapid(lifted,across));
    if(!samePoint(across,b.startSafePoint))motions.push(rapid(across,b.startSafePoint));
    for(let m=1;m<motions.length;m++)if(!samePoint(motions[m-1].end,motions[m].start))errors.push(`Operation ${current.id} → ${next.id}: 004T-Übergang ist nicht zusammenhängend.`);
    transitions.push({fromOperationId:current.id,toOperationId:next.id,motions});
  }
  return{ok:errors.length===0,errors,transitions};
}
