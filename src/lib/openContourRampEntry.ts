import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { ContourOperation } from './types';

const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const p3=(p:ToolpathPoint2,z:number):ToolpathPoint3=>({x:p.x,y:p.y,z});
const line3=(start:ToolpathPoint3,end:ToolpathPoint3,feedMmMin:number):CanonicalSpatialSegment=>({kind:'line3',start,end,feedMmMin});

type RampPoint={point:ToolpathPoint2;distanceMm:number};

function rampPrefix(points:ToolpathPoint2[],requestedLengthMm:number):{points:RampPoint[];lengthMm:number;totalLengthMm:number}{
  if(points.length<2)return{points:[],lengthMm:0,totalLengthMm:0};
  let totalLengthMm=0;
  for(let i=1;i<points.length;i++)totalLengthMm+=dist(points[i-1],points[i]);
  const lengthMm=Math.min(requestedLengthMm,totalLengthMm);
  if(!(lengthMm>EPS))return{points:[],lengthMm,totalLengthMm};

  const out:RampPoint[]=[{point:{...points[0]},distanceMm:0}];
  let walked=0;
  for(let i=1;i<points.length&&walked<lengthMm-EPS;i++){
    const a=points[i-1],b=points[i],segmentLength=dist(a,b);
    if(!(segmentLength>EPS))continue;
    const remaining=lengthMm-walked;
    if(segmentLength<=remaining+EPS){
      walked+=segmentLength;
      out.push({point:{...b},distanceMm:Math.min(walked,lengthMm)});
      continue;
    }
    const t=remaining/segmentLength;
    walked=lengthMm;
    out.push({point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},distanceMm:lengthMm});
  }
  return{points:out,lengthMm,totalLengthMm};
}

function rampEntryForRun(run:CanonicalToolpathRun,previousZ:number,operation:ContourOperation,rampLengthMm:number){
  const prefix=rampPrefix(run.points,rampLengthMm);
  if(prefix.points.length<2)return{entry:null as CanonicalSpatialSegment[]|null,...prefix};
  const entry:CanonicalSpatialSegment[]=[];
  const start=prefix.points[0].point;
  const safe=p3(start,operation.safeZMm),previous=p3(start,previousZ);
  if(Math.abs(operation.safeZMm-previousZ)>EPS)entry.push(line3(safe,previous,operation.plungeMmMin));

  const rampFeed=Math.min(operation.feedMmMin,operation.plungeMmMin);
  for(let i=1;i<prefix.points.length;i++){
    const a=prefix.points[i-1],b=prefix.points[i];
    const z0=previousZ+(run.z-previousZ)*(a.distanceMm/prefix.lengthMm);
    const z1=previousZ+(run.z-previousZ)*(b.distanceMm/prefix.lengthMm);
    entry.push(line3(p3(a.point,z0),p3(b.point,z1),rampFeed));
  }

  // 004Z-E2 cleanup: after reaching the new Z level, traverse the ramp prefix
  // backwards at final depth. The normal run then starts at the original XY and
  // cuts the entire groove at run.z; no wedge-shaped rest material remains.
  for(let i=prefix.points.length-1;i>0;i--){
    entry.push(line3(p3(prefix.points[i].point,run.z),p3(prefix.points[i-1].point,run.z),operation.feedMmMin));
  }
  return{entry,...prefix};
}

export function applyOpenContourRampEntry(toolpath:CanonicalToolpath,operation:ContourOperation,initialZ:number):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  const enabled=operation.topology==='open'&&(operation.leadMode??'none')==='line';
  if(!enabled)return{toolpath,errors:[],warnings:[]};
  const errors:string[]=[],warnings:string[]=[];
  if(toolpath.operationKind!=='contour')errors.push('004Z-E2 Rampeneinfahrt benötigt einen kanonischen Konturwerkzeugweg.');
  const requestedLengthMm=operation.leadInLengthMm??Math.max(3,operation.tool.diameterMm*2);
  if(!(requestedLengthMm>0))errors.push('Rampenlänge muss größer als 0 sein.');
  if(!(operation.safeZMm>initialZ))errors.push('004Z-E2 benötigt Sicherheits-Z oberhalb der ersten Materialebene.');
  if(errors.length)return{toolpath,errors,warnings};

  let previousZ=initialZ;
  let shortestActual=Infinity;
  const runs=toolpath.runs.map((run,index)=>{
    const copy:CanonicalToolpathRun={...run,entrySegments:undefined,exitSegments:undefined};
    if(run.points.length<2){errors.push(`004Z-E2 Werkzeugbahn ${index+1}: offene Kontur hat weniger als zwei Punkte.`);return copy;}
    const result=rampEntryForRun(copy,previousZ,operation,requestedLengthMm);
    if(!result.entry?.length){errors.push(`004Z-E2 Werkzeugbahn ${index+1}: keine nutzbare Rampenstrecke entlang der Kontur.`);return copy;}
    shortestActual=Math.min(shortestActual,result.lengthMm);
    if(result.totalLengthMm+EPS<requestedLengthMm)warnings.push(`004Z-E2 Werkzeugbahn ${index+1}: Rampenlänge auf verfügbare Konturlänge ${result.lengthMm.toFixed(3)} mm begrenzt.`);
    copy.entrySegments=result.entry;
    // No lateral/open-contour lead-out: 004T retracts vertically at the groove end.
    copy.exitSegments=undefined;
    previousZ=run.z;
    return copy;
  });
  if(errors.length)return{toolpath,errors,warnings};
  warnings.push(`004Z-E2: Offene Nut mit Rampeneinfahrt ${Number.isFinite(shortestActual)?shortestActual.toFixed(3):requestedLengthMm.toFixed(3)} mm · jede Zustellung startet auf der vorherigen Z-Ebene · Ausfahrt per Sicherheits-Retract.`);
  return{toolpath:{...toolpath,runs},errors:[],warnings};
}
