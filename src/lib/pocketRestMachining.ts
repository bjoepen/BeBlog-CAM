import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';

export type PocketRestMachiningResult={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];keptRuns:number;removedRuns:number};
const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointSegmentDistance(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=EPS)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function previousSegments(toolpath:CanonicalToolpath,z:number){const result:{a:ToolpathPoint2;b:ToolpathPoint2}[]=[];for(const run of toolpath.runs){if(run.z>z+EPS)continue;for(let i=1;i<run.points.length;i++)result.push({a:run.points[i-1],b:run.points[i]});}return result;}
function minDistanceToPrevious(p:ToolpathPoint2,segments:{a:ToolpathPoint2;b:ToolpathPoint2}[]){let best=Infinity;for(const s of segments)best=Math.min(best,pointSegmentDistance(p,s.a,s.b));return best;}
function keepRun(run:CanonicalToolpathRun,previous:CanonicalToolpath,clearance:number){const segments=previousSegments(previous,run.z);if(!segments.length)return true;for(const p of run.points)if(minDistanceToPrevious(p,segments)>clearance+EPS)return true;return false;}
export function applyPocketRestMachining(args:{current:CanonicalToolpath;previous:CanonicalToolpath;currentToolDiameterMm:number;previousToolDiameterMm:number;}):PocketRestMachiningResult{
  const {current,previous,currentToolDiameterMm,previousToolDiameterMm}=args,errors:string[]=[],warnings:string[]=[];
  if(current.operationKind!=='pocket'||previous.operationKind!=='pocket')errors.push('Restmaterial ist nur zwischen Taschenbearbeitungen freigegeben.');
  if(!(currentToolDiameterMm>0&&previousToolDiameterMm>0))errors.push('Restmaterial benötigt gültige Werkzeugdurchmesser.');
  if(previousToolDiameterMm<=currentToolDiameterMm+EPS)errors.push('Restmaterial benötigt ein kleineres Folgewerkzeug als in der vorherigen Taschenbearbeitung.');
  if(errors.length)return{toolpath:null,errors,warnings,keptRuns:0,removedRuns:0};
  const clearance=(previousToolDiameterMm-currentToolDiameterMm)/2;
  const runs=current.runs.filter(run=>keepRun(run,previous,clearance));
  const removedRuns=current.runs.length-runs.length;
  if(!runs.length)warnings.push('Die vorherige Taschenbearbeitung deckt die aktuelle Werkzeugbahn vollständig ab; es bleibt kein Restmaterial für diese Bearbeitung.');
  else warnings.push(`Restmaterial aktiv: ${runs.length} von ${current.runs.length} Werkzeugbahnen verbleiben nach Swept-Tool-Prüfung.`);
  return{toolpath:runs.length?{...current,runs}:null,errors:[],warnings,keptRuns:runs.length,removedRuns};
}
