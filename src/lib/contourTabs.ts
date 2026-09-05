import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';
import type { ContourOperation } from './types';

export type ContourTabResolution={enabled:boolean;count:number;widthMm:number;heightMm:number;errors:string[];warnings:string[]};

const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const lerp=(a:ToolpathPoint2,b:ToolpathPoint2,t:number):ToolpathPoint2=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

export function resolveContourTabs(operation:ContourOperation):ContourTabResolution{
  const enabled=operation.tabsEnabled??false;
  const count=Math.max(0,Math.floor(operation.tabCount??4));
  const widthMm=operation.tabWidthMm??6;
  const heightMm=operation.tabHeightMm??1.5;
  const errors:string[]=[],warnings:string[]=[];
  if(!enabled)return{enabled:false,count,widthMm,heightMm,errors,warnings};
  if(operation.topology!=='closed')errors.push('Haltestege sind nur für geschlossene Konturen freigegeben.');
  if(count<1)errors.push('Mindestens ein Haltesteg ist erforderlich.');
  if(!(widthMm>0))errors.push('Haltestegbreite muss größer als 0 sein.');
  if(!(heightMm>0))errors.push('Haltesteghöhe muss größer als 0 sein.');
  if(widthMm<2)warnings.push('Haltestegbreite unter 2 mm ist sehr klein.');
  return{enabled:true,count,widthMm,heightMm,errors,warnings};
}

function sampledClosedPoints(run:CanonicalToolpathRun):ToolpathPoint2[]{
  if(run.points.length<2)return[];
  const points=[...run.points];
  const a=points[0],b=points[points.length-1];
  if(dist(a,b)>1e-6)points.push({...a});
  return points;
}

function splitByTabs(run:CanonicalToolpathRun,tabCount:number,tabWidthMm:number,tabZ:number):CanonicalToolpathRun[]{
  const pts=sampledClosedPoints(run);if(pts.length<3)return[run];
  const lengths:number[]=[];let total=0;
  for(let i=1;i<pts.length;i++){const l=dist(pts[i-1],pts[i]);lengths.push(l);total+=l;}
  if(!(total>0))return[run];
  const half=Math.min(tabWidthMm/2,total/(tabCount*3));
  const centers=Array.from({length:tabCount},(_,i)=>(i+.5)*total/tabCount);
  const boundaries=[0,total];for(const c of centers){boundaries.push(Math.max(0,c-half),Math.min(total,c+half));}
  boundaries.sort((a,b)=>a-b);
  const uniq=boundaries.filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-6);
  const pointAt=(s:number)=>{let acc=0;for(let i=0;i<lengths.length;i++){const l=lengths[i];if(s<=acc+l+1e-9)return lerp(pts[i],pts[i+1],l>0?(s-acc)/l:0);acc+=l;}return {...pts[pts.length-1]};};
  const inTab=(s:number)=>centers.some(c=>Math.abs(s-c)<=half+1e-9);
  const out:CanonicalToolpathRun[]=[];
  for(let i=1;i<uniq.length;i++){
    const s0=uniq[i-1],s1=uniq[i];if(s1-s0<=1e-6)continue;
    const mid=(s0+s1)/2,z=inTab(mid)?tabZ:run.z;
    const p0=pointAt(s0),p1=pointAt(s1);
    out.push({kind:'cut',z,points:[p0,p1],segments:[{kind:'line',start:p0,end:p1}]});
  }
  return out.length?out:[run];
}

export function applyContourTabs(toolpath:CanonicalToolpath,operation:ContourOperation,finalDepthMm:number):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  const cfg=resolveContourTabs(operation);
  if(!cfg.enabled)return{toolpath,errors:[],warnings:[]};
  if(cfg.errors.length)return{toolpath,errors:cfg.errors,warnings:cfg.warnings};
  const tabZ=-Math.max(0,finalDepthMm-cfg.heightMm);
  const runs:CanonicalToolpathRun[]=[];
  for(const run of toolpath.runs){
    if(run.z>=tabZ-1e-9){runs.push(run);continue;}
    runs.push(...splitByTabs(run,cfg.count,cfg.widthMm,tabZ));
  }
  return{toolpath:{...toolpath,runs},errors:[],warnings:[...cfg.warnings,`Haltestege aktiv: ${cfg.count} × ${cfg.widthMm.toFixed(3)} mm · Resthöhe ${cfg.heightMm.toFixed(3)} mm.`]};
}
