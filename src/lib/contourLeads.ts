import type { CanonicalSpatialSegment, CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2, ToolpathPoint3 } from './canonicalToolpath';
import type { ContourOperation } from './types';

const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(b.x-a.x,b.y-a.y);
const unit=(a:ToolpathPoint2,b:ToolpathPoint2):ToolpathPoint2|null=>{const d=dist(a,b);return d>EPS?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:null;};

export type ContourLeadResolution={enabled:boolean;leadInMm:number;leadOutMm:number;errors:string[];warnings:string[]};

export function resolveContourLeads(operation:ContourOperation):ContourLeadResolution{
  const enabled=(operation.leadMode??'none')!=='none';
  const leadInMm=operation.leadInLengthMm??3;
  const leadOutMm=operation.leadOutLengthMm??3;
  const errors:string[]=[],warnings:string[]=[];
  if(!enabled)return{enabled:false,leadInMm,leadOutMm,errors,warnings};
  if(!(leadInMm>0))errors.push('Lead-in-Länge muss größer als 0 sein.');
  if(!(leadOutMm>=0))errors.push('Lead-out-Länge darf nicht negativ sein.');
  if(!(operation.safeZMm>0))errors.push('Tangentiale Ein-/Ausfahrten benötigen einen positiven Sicherheits-Z-Wert.');
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

function p3(p:ToolpathPoint2,z:number):ToolpathPoint3{return{x:p.x,y:p.y,z};}
function vertical(a:ToolpathPoint2,z0:number,z1:number):CanonicalSpatialSegment{return{kind:'line3',start:p3(a,z0),end:p3(a,z1)};}
function horizontal(a:ToolpathPoint2,b:ToolpathPoint2,z:number):CanonicalSpatialSegment{return{kind:'line3',start:p3(a,z),end:p3(b,z)};}

/**
 * 004Z-E: Leads are canonical machine geometry for both closed and open contours.
 *
 * Entry contract:
 *   safe Z above tangent start -> plunge there -> tangent into contour.
 * Exit contract:
 *   tangent out of contour -> retract there to safe Z.
 *
 * Keeping the vertical motion at the lead point avoids diagonal 3D rapids between
 * the contour endpoint and an offset tangent point when 004T materializes the run.
 */
function applyLeadToRun(run:CanonicalToolpathRun,cfg:ContourLeadResolution,safeZMm:number){
  if(run.points.length<2)return false;
  const dIn=firstDirection(run),dOut=lastDirection(run);if(!dIn||!dOut)return false;
  const first=run.points[0],last=run.points[run.points.length-1];
  const leadStart={x:first.x-dIn.x*cfg.leadInMm,y:first.y-dIn.y*cfg.leadInMm};
  const entry:CanonicalSpatialSegment[]=[
    vertical(leadStart,safeZMm,run.z),
    horizontal(leadStart,first,run.z),
  ];
  run.entrySegments=entry;

  if(cfg.leadOutMm>EPS){
    const leadEnd={x:last.x+dOut.x*cfg.leadOutMm,y:last.y+dOut.y*cfg.leadOutMm};
    const exit:CanonicalSpatialSegment[]=[
      horizontal(last,leadEnd,run.z),
      vertical(leadEnd,run.z,safeZMm),
    ];
    run.exitSegments=exit;
  }
  return true;
}

export function applyContourLeads(toolpath:CanonicalToolpath,operation:ContourOperation):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  const cfg=resolveContourLeads(operation);
  if(!cfg.enabled)return{toolpath,errors:[],warnings:[]};
  if(cfg.errors.length)return{toolpath,errors:cfg.errors,warnings:cfg.warnings};
  if(toolpath.operationKind!=='contour')return{toolpath,errors:['Lead-in/Lead-out benötigt einen kanonischen Konturwerkzeugweg.'],warnings:cfg.warnings};

  const runs=toolpath.runs.map(run=>({...run,entrySegments:run.entrySegments?[...run.entrySegments]:undefined,exitSegments:run.exitSegments?[...run.exitSegments]:undefined}));
  let applied=0;
  for(const run of runs)if(applyLeadToRun(run,cfg,operation.safeZMm))applied++;
  if(!applied)return{toolpath,errors:['Für Lead-in/Lead-out wurde keine zusammenhängende Konturpassage gefunden.'],warnings:cfg.warnings};

  const topology=operation.topology==='open'?'offene':'geschlossene';
  return{toolpath:{...toolpath,runs},errors:[],warnings:[...cfg.warnings,`Tangentiale Leads aktiv (${topology} Kontur): Einfahrt ${cfg.leadInMm.toFixed(3)} mm · Ausfahrt ${cfg.leadOutMm.toFixed(3)} mm.`]};
}
