import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { ContourOperation } from './types';

const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const lerp=(a:ToolpathPoint2,b:ToolpathPoint2,t:number):ToolpathPoint2=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const p3=(p:ToolpathPoint2,z:number):ToolpathPoint3=>({x:p.x,y:p.y,z});
const line3=(start:ToolpathPoint3,end:ToolpathPoint3,feedMmMin:number):CanonicalSpatialSegment=>({kind:'line3',start,end,feedMmMin});

export type StepContourTabResolution={enabled:boolean;count:number;widthMm:number;heightMm:number;errors:string[];warnings:string[]};

type PathMetric={points:ToolpathPoint2[];lengths:number[];total:number;closed:boolean};

function metric(run:CanonicalToolpathRun,closed:boolean):PathMetric{
  const points=run.points.map(point=>({...point}));
  if(closed&&points.length>1&&dist(points[0],points.at(-1)!)>EPS)points.push({...points[0]});
  const lengths:number[]=[];let total=0;
  for(let i=1;i<points.length;i++){const length=dist(points[i-1],points[i]);lengths.push(length);total+=length;}
  return{points,lengths,total,closed};
}

function pointAt(path:PathMetric,s:number):ToolpathPoint2{
  const target=Math.max(0,Math.min(path.total,s));let walked=0;
  for(let i=0;i<path.lengths.length;i++){
    const length=path.lengths[i];
    if(target<=walked+length+EPS)return lerp(path.points[i],path.points[i+1],length>EPS?(target-walked)/length:0);
    walked+=length;
  }
  return{...path.points.at(-1)!};
}

function tabIntervals(path:PathMetric,count:number,widthMm:number):{start:number;end:number}[]{
  if(!(path.total>EPS))return[];
  const spacing=path.closed?path.total/count:path.total/(count+1);
  const half=Math.min(widthMm/2,spacing*.35);
  const centers=Array.from({length:count},(_,index)=>path.closed?(index+.5)*spacing:(index+1)*spacing);
  return centers.map(center=>({start:Math.max(0,center-half),end:Math.min(path.total,center+half)}));
}

function spatialTabCut(run:CanonicalToolpathRun,operation:ContourOperation,tabZ:number):CanonicalSpatialSegment[]|null{
  const path=metric(run,operation.topology==='closed');
  if(path.points.length<2||!(path.total>EPS))return null;
  const intervals=tabIntervals(path,Math.max(1,Math.floor(operation.tabCount??4)),operation.tabWidthMm??6);
  if(!intervals.length)return null;
  const boundaries=[0,path.total,...intervals.flatMap(interval=>[interval.start,interval.end])].sort((a,b)=>a-b).filter((value,index,all)=>index===0||Math.abs(value-all[index-1])>EPS);
  const inTab=(s:number)=>intervals.some(interval=>s>interval.start-EPS&&s<interval.end+EPS);
  const motions:CanonicalSpatialSegment[]=[];
  let current=p3(pointAt(path,0),run.z);
  for(let i=1;i<boundaries.length;i++){
    const s0=boundaries[i-1],s1=boundaries[i];if(s1-s0<=EPS)continue;
    const active=inTab((s0+s1)/2),start=pointAt(path,s0),end=pointAt(path,s1),z=active?tabZ:run.z;
    const start3=p3(start,z);
    if(Math.abs(current.x-start3.x)>EPS||Math.abs(current.y-start3.y)>EPS||Math.abs(current.z-start3.z)>EPS)motions.push(line3(current,start3,Math.min(operation.feedMmMin,operation.plungeMmMin)));
    const end3=p3(end,z);motions.push(line3(start3,end3,operation.feedMmMin));current=end3;
  }
  return motions;
}

export function resolveStepContourTabs(operation:ContourOperation,startZ:number,finalZ:number):StepContourTabResolution{
  const enabled=operation.tabsEnabled??false,count=Math.max(0,Math.floor(operation.tabCount??4)),widthMm=operation.tabWidthMm??6,heightMm=operation.tabHeightMm??1.5;
  const errors:string[]=[],warnings:string[]=[];
  if(!enabled)return{enabled:false,count,widthMm,heightMm,errors,warnings};
  if(count<1)errors.push('Mindestens ein Haltesteg ist erforderlich.');
  if(!(widthMm>0))errors.push('Haltestegbreite muss größer als 0 sein.');
  if(!(heightMm>0))errors.push('Haltesteghöhe muss größer als 0 sein.');
  const depth=startZ-finalZ;
  if(!(depth>EPS))errors.push('004Z-F benötigt eine Konturtiefe unterhalb der Startreferenz.');
  if(heightMm>=depth-EPS)errors.push(`Haltesteghöhe ${heightMm.toFixed(3)} mm muss kleiner als die tatsächlich geschnittene Tiefe ${depth.toFixed(3)} mm sein.`);
  if(widthMm<2)warnings.push('Haltestegbreite unter 2 mm ist sehr klein.');
  return{enabled:true,count,widthMm,heightMm,errors,warnings};
}

export function applyStepContourTabs(toolpath:CanonicalToolpath,operation:ContourOperation,startZ:number):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  if(toolpath.operationKind!=='contour')return{toolpath,errors:['004Z-F Haltestege benötigen einen kanonischen Konturwerkzeugweg.'],warnings:[]};
  if(!toolpath.runs.length)return{toolpath,errors:['004Z-F Haltestege benötigen mindestens eine Konturpassage.'],warnings:[]};
  const finalZ=Math.min(...toolpath.runs.map(run=>run.z)),cfg=resolveStepContourTabs(operation,startZ,finalZ);
  if(!cfg.enabled)return{toolpath,errors:[],warnings:[]};
  if(cfg.errors.length)return{toolpath,errors:cfg.errors,warnings:cfg.warnings};
  const tabZ=finalZ+cfg.heightMm;
  let tabbedRuns=0;
  const runs=toolpath.runs.map((run,index)=>{
    const copy:CanonicalToolpathRun={...run,cutSegments3:undefined};
    if(run.z>=tabZ-EPS)return copy;
    const cutSegments3=spatialTabCut(copy,operation,tabZ);
    if(!cutSegments3?.length){return copy;}
    tabbedRuns++;
    return{...copy,cutSegments3};
  });
  if(!tabbedRuns)return{toolpath,errors:[`004Z-F: Keine Zustellung liegt unterhalb der Haltesteg-Oberkante Z ${tabZ.toFixed(3)} mm.`],warnings:cfg.warnings};
  const topology=operation.topology==='open'?'offenen':'geschlossenen';
  return{toolpath:{...toolpath,runs},errors:[],warnings:[...cfg.warnings,`004Z-F: ${cfg.count} Haltesteg${cfg.count===1?'':'e'} an der ${topology} STEP-Kontur · Breite ${cfg.widthMm.toFixed(3)} mm · Resthöhe ${cfg.heightMm.toFixed(3)} mm · Oberkante Z ${tabZ.toFixed(3)} mm · ohne Zwischen-Retracts.`]};
}
