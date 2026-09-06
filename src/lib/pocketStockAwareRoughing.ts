import type { CanonicalToolpath, CanonicalToolpathRun, ToolpathPoint2 } from './canonicalToolpath';

export type PocketStockAwareResult={toolpath:CanonicalToolpath|null;errors:string[];warnings:string[];keptRuns:number;skippedRuns:number;maxObservedEngagementMm:number};
const EPS=1e-6;
const dist=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointSegmentDistance(p:ToolpathPoint2,a:ToolpathPoint2,b:ToolpathPoint2){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<=EPS)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function runSegments(run:CanonicalToolpathRun){const result:{a:ToolpathPoint2;b:ToolpathPoint2}[]=[];for(let i=1;i<run.points.length;i++)result.push({a:run.points[i-1],b:run.points[i]});return result;}
function minDistance(p:ToolpathPoint2,segments:{a:ToolpathPoint2;b:ToolpathPoint2}[]){let best=Infinity;for(const s of segments)best=Math.min(best,pointSegmentDistance(p,s.a,s.b));return best;}
function sampled(run:CanonicalToolpathRun){const points:ToolpathPoint2[]=[];for(let i=1;i<run.points.length;i++){const a=run.points[i-1],b=run.points[i],length=dist(a,b),steps=Math.max(1,Math.ceil(length/1));for(let j=0;j<=steps;j++){const t=j/steps;points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return points.length?points:run.points;}

export function applyPocketStockAwareRoughing(args:{toolpath:CanonicalToolpath;toolDiameterMm:number;maxRadialEngagementPercent:number;}):PocketStockAwareResult{
  const {toolpath,toolDiameterMm,maxRadialEngagementPercent}=args,errors:string[]=[],warnings:string[]=[];
  if(toolpath.operationKind!=='pocket')errors.push('Stock-aware Roughing ist nur für Taschenwerkzeugwege freigegeben.');
  if(!(toolDiameterMm>0))errors.push('Stock-aware Roughing benötigt einen gültigen Werkzeugdurchmesser.');
  if(!(maxRadialEngagementPercent>0&&maxRadialEngagementPercent<=100))errors.push('Maximale radiale Werkzeugbelastung muss zwischen 0 und 100 % liegen.');
  if(errors.length)return{toolpath:null,errors,warnings,keptRuns:0,skippedRuns:0,maxObservedEngagementMm:0};
  const maxEngagementMm=toolDiameterMm*maxRadialEngagementPercent/100,kept:CanonicalToolpath['runs']=[];
  let skippedRuns=0,maxObserved=0;
  const byZ=new Map<string,{a:ToolpathPoint2;b:ToolpathPoint2}[]>();
  for(const run of toolpath.runs){
    const key=run.z.toFixed(6),cleared=byZ.get(key)??[],samples=sampled(run);
    if(!cleared.length){kept.push(run);byZ.set(key,runSegments(run));continue;}
    const distances=samples.map(p=>minDistance(p,cleared)),meaningful=distances.filter(d=>d>1e-3);
    if(!meaningful.length){skippedRuns++;continue;}
    const observed=Math.max(...meaningful);maxObserved=Math.max(maxObserved,observed);
    if(observed>maxEngagementMm+1e-3){errors.push(`Stock-aware Roughing: Werkzeugbahn bei Z${run.z.toFixed(3)} mm benötigt bis zu ${observed.toFixed(3)} mm radialen Eingriff; erlaubt sind ${maxEngagementMm.toFixed(3)} mm (${maxRadialEngagementPercent.toFixed(1)} % von Ø${toolDiameterMm.toFixed(3)} mm).`);continue;}
    kept.push(run);cleared.push(...runSegments(run));byZ.set(key,cleared);
  }
  if(errors.length)return{toolpath:null,errors,warnings,keptRuns:kept.length,skippedRuns,maxObservedEngagementMm:maxObserved};
  if(skippedRuns)warnings.push(`Stock-aware Roughing überspringt ${skippedRuns} bereits geräumte Werkzeugbahn${skippedRuns===1?'':'en'}.`);
  warnings.push(`Stock-aware Roughing aktiv: maximale radiale Werkzeugbelastung ${maxRadialEngagementPercent.toFixed(1)} % = ${maxEngagementMm.toFixed(3)} mm; beobachtet bis ${maxObserved.toFixed(3)} mm nach dem Initialschnitt jeder Z-Ebene.`);
  return{toolpath:kept.length?{...toolpath,runs:kept}:null,errors:[],warnings,keptRuns:kept.length,skippedRuns,maxObservedEngagementMm:maxObserved};
}
