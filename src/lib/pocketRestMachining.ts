import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';

export type PocketRestMachiningResult={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];keptRuns:number;removedRuns:number};
const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointSegmentDistance(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=EPS)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function previousSegments(toolpath:CanonicalToolpath,z:number){const result:{a:ToolpathPoint2;b:ToolpathPoint2}[]=[];for(const run of toolpath.runs){if(run.z>z+EPS)continue;for(let i=1;i<run.points.length;i++)result.push({a:run.points[i-1],b:run.points[i]});}return result;}
function minDistanceToPrevious(p:ToolpathPoint2,segments:{a:ToolpathPoint2;b:ToolpathPoint2}[]){let best=Infinity;for(const s of segments)best=Math.min(best,pointSegmentDistance(p,s.a,s.b));return best;}
function needsRest(a:ToolpathPoint2,b:ToolpathPoint2,segments:{a:ToolpathPoint2;b:ToolpathPoint2}[],clearance:number){if(!segments.length)return true;const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};return Math.max(minDistanceToPrevious(a,segments),minDistanceToPrevious(mid,segments),minDistanceToPrevious(b,segments))>clearance+EPS;}
function splitRun(run:CanonicalToolpathRun,previous:CanonicalToolpath,clearance:number):CanonicalToolpathRun[]{const previousAtDepth=previousSegments(previous,run.z),result:CanonicalToolpathRun[]=[];let points:ToolpathPoint2[]=[];const flush=()=>{if(points.length>=2)result.push({kind:'cut',z:run.z,points:[...points],segments:points.slice(1).map((end,i)=>({kind:'line' as const,start:points[i],end})),retractAfter:true});points=[];};for(let i=1;i<run.points.length;i++){const a=run.points[i-1],b=run.points[i],keep=needsRest(a,b,previousAtDepth,clearance);if(keep){if(!points.length)points=[a];points.push(b);}else flush();}flush();return result;}
export function applyPocketRestMachining(args:{current:CanonicalToolpath;previous:CanonicalToolpath;currentToolDiameterMm:number;previousToolDiameterMm:number;}):PocketRestMachiningResult{
  const {current,previous,currentToolDiameterMm,previousToolDiameterMm}=args,errors:string[]=[],warnings:string[]=[];
  if(current.operationKind!=='pocket'||previous.operationKind!=='pocket')errors.push('Restmaterial ist nur zwischen Taschenbearbeitungen freigegeben.');
  if(!(currentToolDiameterMm>0&&previousToolDiameterMm>0))errors.push('Restmaterial benötigt gültige Werkzeugdurchmesser.');
  if(previousToolDiameterMm<=currentToolDiameterMm+EPS)errors.push('Restmaterial benötigt ein kleineres Folgewerkzeug als in der vorherigen Taschenbearbeitung.');
  if(errors.length)return{toolpath:null,errors,warnings,keptRuns:0,removedRuns:0};
  const clearance=(previousToolDiameterMm-currentToolDiameterMm)/2,runs=current.runs.flatMap(run=>splitRun(run,previous,clearance)),removedRuns=Math.max(0,current.runs.length-runs.length);
  if(!runs.length)warnings.push('Die vorherige Taschenbearbeitung deckt die aktuelle Werkzeugbahn vollständig ab; es bleibt kein Restmaterial für diese Bearbeitung.');
  else warnings.push(`Restmaterial aktiv: ${runs.length} Restsegment${runs.length===1?'':'e'} nach Swept-Tool-Prüfung.`);
  return{toolpath:runs.length?{...current,runs}:null,errors:[],warnings,keptRuns:runs.length,removedRuns};
}
