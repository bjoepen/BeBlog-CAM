import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';
import type { ContourOperation } from './types';

const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const same=(a:ToolpathPoint2,b:ToolpathPoint2)=>dist(a,b)<=1e-5;
const unit=(a:ToolpathPoint2,b:ToolpathPoint2):ToolpathPoint2|null=>{const d=dist(a,b);return d>EPS?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:null;};

export type ContourLeadResolution={enabled:boolean;leadInMm:number;leadOutMm:number;errors:string[];warnings:string[]};

export function resolveContourLeads(operation:ContourOperation):ContourLeadResolution{
  const enabled=(operation.leadMode??'none')!=='none';
  const leadInMm=operation.leadInLengthMm??3;
  const leadOutMm=operation.leadOutLengthMm??3;
  const errors:string[]=[],warnings:string[]=[];
  if(!enabled)return{enabled:false,leadInMm,leadOutMm,errors,warnings};
  if(operation.topology!=='closed')errors.push('Lead-in/Lead-out ist in 004K nur für geschlossene Konturen freigegeben.');
  if(!(leadInMm>0))errors.push('Lead-in-Länge muss größer als 0 sein.');
  if(!(leadOutMm>=0))errors.push('Lead-out-Länge darf nicht negativ sein.');
  if(leadInMm<operation.tool.diameterMm*.5)warnings.push('Lead-in ist kürzer als ein halber Werkzeugdurchmesser.');
  return{enabled:true,leadInMm,leadOutMm,errors,warnings};
}

function firstDirection(run:CanonicalToolpathRun):ToolpathPoint2|null{
  if(run.segments?.length){const s=run.segments[0];const d=unit(s.start,s.end);if(d)return d;}
  for(let i=1;i<run.points.length;i++){const d=unit(run.points[i-1],run.points[i]);if(d)return d;}
  return null;
}
function lastDirection(run:CanonicalToolpathRun):ToolpathPoint2|null{
  if(run.segments?.length){const s=run.segments[run.segments.length-1];const d=unit(s.start,s.end);if(d)return d;}
  for(let i=run.points.length-1;i>0;i--){const d=unit(run.points[i-1],run.points[i]);if(d)return d;}
  return null;
}

function partitionClosedChains(runs:CanonicalToolpathRun[]):CanonicalToolpathRun[][]{
  const out:CanonicalToolpathRun[][]=[];let chain:CanonicalToolpathRun[]=[];let start:ToolpathPoint2|null=null;let end:ToolpathPoint2|null=null;
  const flush=()=>{if(chain.length)out.push(chain);chain=[];start=end=null;};
  for(const run of runs){if(run.points.length<2){flush();out.push([run]);continue;}const a=run.points[0],b=run.points[run.points.length-1];if(!chain.length){chain=[run];start=a;end=b;}else if(end&&same(end,a)){chain.push(run);end=b;}else{flush();chain=[run];start=a;end=b;}if(start&&end&&same(start,end))flush();}
  flush();return out;
}

export function applyContourLeads(toolpath:CanonicalToolpath,operation:ContourOperation):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  const cfg=resolveContourLeads(operation);
  if(!cfg.enabled)return{toolpath,errors:[],warnings:[]};
  if(cfg.errors.length)return{toolpath,errors:cfg.errors,warnings:cfg.warnings};
  if(toolpath.operationKind!=='contour')return{toolpath,errors:['Lead-in/Lead-out benötigt einen kanonischen Konturwerkzeugweg.'],warnings:cfg.warnings};
  const runs=toolpath.runs.map(run=>({...run,entrySegments:run.entrySegments?[...run.entrySegments]:undefined,exitSegments:run.exitSegments?[...run.exitSegments]:undefined}));
  const chains=partitionClosedChains(runs);
  let applied=0;
  for(const chain of chains){if(!chain.length)continue;const first=chain[0],last=chain[chain.length-1];if(first.points.length<2||last.points.length<2)continue;const firstPoint=first.points[0],lastPoint=last.points[last.points.length-1];if(!same(firstPoint,lastPoint))continue;const dIn=firstDirection(first),dOut=lastDirection(last);if(!dIn||!dOut)continue;
    const leadStart={x:firstPoint.x-dIn.x*cfg.leadInMm,y:firstPoint.y-dIn.y*cfg.leadInMm,z:first.z};
    const contourStart={x:firstPoint.x,y:firstPoint.y,z:first.z};
    const entry:CanonicalSpatialSegment={kind:'line3',start:leadStart,end:contourStart};
    first.entrySegments=[entry];
    if(cfg.leadOutMm>EPS){const contourEnd={x:lastPoint.x,y:lastPoint.y,z:last.z};const leadEnd={x:lastPoint.x+dOut.x*cfg.leadOutMm,y:lastPoint.y+dOut.y*cfg.leadOutMm,z:last.z};const exit:CanonicalSpatialSegment={kind:'line3',start:contourEnd,end:leadEnd};last.exitSegments=[exit];}
    applied++;
  }
  if(!applied)return{toolpath,errors:['Für Lead-in/Lead-out wurde keine geschlossene zusammenhängende Konturpassage gefunden.'],warnings:cfg.warnings};
  return{toolpath:{...toolpath,runs},errors:[],warnings:[...cfg.warnings,`Tangentiale Leads aktiv: Einfahrt ${cfg.leadInMm.toFixed(3)} mm · Ausfahrt ${cfg.leadOutMm.toFixed(3)} mm.`]};
}
