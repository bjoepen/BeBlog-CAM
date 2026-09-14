import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { ContourOperation } from './types';
import { applyContourLeads } from './contourLeads';

const EPS=1e-7;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const p3=(point:ToolpathPoint2,z:number):ToolpathPoint3=>({x:point.x,y:point.y,z});

export type ResolvedContourEntryMode='plunge'|'lead'|'ramp';
export function resolvedContourEntryMode(operation:ContourOperation):ResolvedContourEntryMode{
  if(operation.entryMode)return operation.entryMode;
  return (operation.leadMode??'none')==='line'?'lead':'plunge';
}

function perimeter(points:ToolpathPoint2[]){return points.slice(1).reduce((sum,point,index)=>sum+dist(points[index],point),0);}

function rampPolyline(points:ToolpathPoint2[],required:number){
  const used:ToolpathPoint2[]=[{...points[0]}];let remaining=required;
  for(let i=1;i<points.length&&remaining>EPS;i++){
    const a=points[i-1],b=points[i],length=dist(a,b);if(length<=EPS)continue;
    if(length<=remaining+EPS){used.push({...b});remaining-=length;continue;}
    const t=remaining/length;used.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});remaining=0;
  }
  return{points:used,complete:remaining<=EPS};
}

function rampEntry(run:CanonicalToolpathRun,zStart:number,safeZMm:number,angleDeg:number,plungeMmMin:number){
  if(!(angleDeg>0&&angleDeg<=15))return{segments:null as CanonicalSpatialSegment[]|null,error:'Kontur-Rampenwinkel muss größer als 0 und höchstens 15° sein.',required:0,available:0};
  const delta=Math.abs(run.z-zStart),required=delta<=EPS?0:delta/Math.tan(angleDeg*Math.PI/180),available=perimeter(run.points);
  if(required>available-EPS)return{segments:null,error:`Kontur-Rampe benötigt ${required.toFixed(3)} mm, die geschlossene Kontur bietet ab dem gewählten Start nur ${available.toFixed(3)} mm.`,required,available};
  const ramp=required<=EPS?{points:[{...run.points[0]}],complete:true}:rampPolyline(run.points,required);
  if(!ramp.complete)return{segments:null,error:'Kontur-Rampe konnte trotz rechnerisch ausreichender Länge nicht vollständig aufgebaut werden.',required,available};
  const segments:CanonicalSpatialSegment[]=[];
  const start=run.points[0];
  if(Math.abs(safeZMm-zStart)>EPS)segments.push({kind:'line3',start:p3(start,safeZMm),end:p3(start,zStart),feedMmMin:plungeMmMin});
  let travelled=0;
  for(let i=1;i<ramp.points.length;i++){
    const a=ramp.points[i-1],b=ramp.points[i],length=dist(a,b),z0=required>EPS?zStart+(run.z-zStart)*(travelled/required):run.z,z1=required>EPS?zStart+(run.z-zStart)*((travelled+length)/required):run.z;
    segments.push({kind:'line3',start:p3(a,z0),end:p3(b,z1),feedMmMin:plungeMmMin});travelled+=length;
  }
  const reverse=[...ramp.points].reverse();
  for(let i=1;i<reverse.length;i++)segments.push({kind:'line3',start:p3(reverse[i-1],run.z),end:p3(reverse[i],run.z)});
  const end=segments.at(-1)?.end??p3(start,zStart);
  if(Math.abs(end.x-start.x)>EPS||Math.abs(end.y-start.y)>EPS||Math.abs(end.z-run.z)>EPS)return{segments:null,error:'Kontur-Rampe endet nicht am kanonischen Konturstart auf Soll-Z.',required,available};
  return{segments,error:null as string|null,required,available};
}

export function applyContourEntry(toolpath:CanonicalToolpath,operation:ContourOperation):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  if(toolpath.operationKind!=='contour')return{toolpath,errors:['Kontureinfahrt benötigt einen kanonischen Konturwerkzeugweg.'],warnings:[]};
  const mode=resolvedContourEntryMode(operation);
  if(mode==='lead')return applyContourLeads(toolpath,{...operation,leadMode:'line'});
  if(mode==='plunge')return{toolpath:{...toolpath,runs:toolpath.runs.map(run=>({...run,entrySegments:undefined,exitSegments:undefined}))},errors:[],warnings:[]};
  if(operation.topology!=='closed')return{toolpath,errors:['RW-006 Rampeneinfahrt ist nur für vollständig geschlossene Konturen freigegeben.'],warnings:[]};
  if((operation.excludedSegmentIds??[]).length)return{toolpath,errors:['Rampeneinfahrt ist für aufgebrochene Konturen nicht freigegeben.'],warnings:[]};
  const angle=Number(operation.rampAngleDeg??3),runs:CanonicalToolpath['runs']=[],warnings:string[]=[];
  let previousDepth=0;
  for(const [index,run] of toolpath.runs.entries()){
    const entry=rampEntry(run,previousDepth,operation.safeZMm,angle,operation.plungeMmMin);
    if(entry.error||!entry.segments)return{toolpath,errors:[`Kontur-Z-Ebene ${index+1}: ${entry.error??'Rampe konnte nicht aufgebaut werden.'}`],warnings};
    runs.push({...run,entrySegments:entry.segments,exitSegments:undefined});
    warnings.push(`Kontur-Rampe Ebene ${index+1}: ${angle.toFixed(1)}° · benötigt ${entry.required.toFixed(3)} mm · verfügbar ${entry.available.toFixed(3)} mm.`);
    previousDepth=run.z;
  }
  return{toolpath:{...toolpath,runs,motions:undefined},errors:[],warnings};
}
