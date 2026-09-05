import type { CanonicalToolpath, CanonicalToolpathRun, CanonicalToolpathSegment, ToolpathPoint2 } from './canonicalToolpath';
import { offsetPolygon } from './contourMath';
import type { ContourOperation } from './types';

export type ContourFinishingResolution={
  radialAllowanceMm:number;
  axialAllowanceMm:number;
  finishPassEnabled:boolean;
  finishPassCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-9;
const same=(a:ToolpathPoint2,b:ToolpathPoint2)=>Math.hypot(a.x-b.x,a.y-b.y)<=1e-6;

export function resolveContourFinishing(operation:ContourOperation,finalDepthMm:number):ContourFinishingResolution{
  const radialAllowanceMm=operation.radialAllowanceMm??0;
  const axialAllowanceMm=operation.axialAllowanceMm??0;
  const finishPassEnabled=operation.finishPassEnabled??false;
  const finishPassCount=Math.max(1,Math.floor(operation.finishPassCount??1));
  const errors:string[]=[],warnings:string[]=[];
  const active=radialAllowanceMm>EPS||axialAllowanceMm>EPS||finishPassEnabled;
  if(!active)return{radialAllowanceMm,axialAllowanceMm,finishPassEnabled,finishPassCount,errors,warnings};
  if(operation.topology!=='closed')errors.push('Aufmaß und Schlichtdurchgänge sind in 004L nur für geschlossene Konturen freigegeben.');
  if(radialAllowanceMm<0)errors.push('Radiales Aufmaß darf nicht negativ sein.');
  if(axialAllowanceMm<0)errors.push('Axiales Aufmaß darf nicht negativ sein.');
  if(axialAllowanceMm>=finalDepthMm-EPS&&axialAllowanceMm>0)errors.push('Axiales Aufmaß muss kleiner als die gesamte Konturtiefe sein.');
  if(radialAllowanceMm>0&&operation.side==='on-line')errors.push('Radiales Aufmaß ist für „Auf Linie“ nicht eindeutig und deshalb gesperrt.');
  if(finishPassCount<1)errors.push('Mindestens ein Schlichtdurchgang ist erforderlich.');
  if((radialAllowanceMm>0||axialAllowanceMm>0)&&!finishPassEnabled)warnings.push('Aufmaß bleibt stehen, weil kein Schlichtdurchgang aktiviert ist.');
  if(finishPassEnabled&&radialAllowanceMm<=EPS&&axialAllowanceMm<=EPS&&finishPassCount>1)warnings.push('Mehrere Schlichtdurchgänge ohne Aufmaß wirken als Wiederhol-/Spring-Pässe.');
  return{radialAllowanceMm,axialAllowanceMm,finishPassEnabled,finishPassCount,errors,warnings};
}

function closedPoints(run:CanonicalToolpathRun):ToolpathPoint2[]{
  if(run.points.length<3)return[];
  const points=run.points.map(p=>({...p}));
  if(!same(points[0],points[points.length-1]))points.push({...points[0]});
  return points;
}

function lineSegments(points:ToolpathPoint2[]):CanonicalToolpathSegment[]{
  const segments:CanonicalToolpathSegment[]=[];
  for(let i=1;i<points.length;i++)segments.push({kind:'line',start:points[i-1],end:points[i]});
  return segments;
}

function roughRun(run:CanonicalToolpathRun,radialSignedMm:number,z:number):CanonicalToolpathRun{
  if(Math.abs(radialSignedMm)<=EPS)return{...run,z,entrySegments:undefined,exitSegments:undefined};
  const source=closedPoints(run);
  const points=offsetPolygon(source,radialSignedMm).map(p=>({x:p.x,y:p.y}));
  return{kind:'cut',z,points,segments:lineSegments(points)};
}

export function applyContourFinishing(toolpath:CanonicalToolpath,operation:ContourOperation,finalDepthMm:number):{toolpath:CanonicalToolpath;errors:string[];warnings:string[]}{
  const cfg=resolveContourFinishing(operation,finalDepthMm);
  if(cfg.errors.length)return{toolpath,errors:cfg.errors,warnings:cfg.warnings};
  const active=cfg.radialAllowanceMm>EPS||cfg.axialAllowanceMm>EPS||cfg.finishPassEnabled;
  if(!active)return{toolpath,errors:[],warnings:[]};
  const nominalRuns=toolpath.runs;
  if(!nominalRuns.length)return{toolpath,errors:['Kontur besitzt keine kanonischen Schnittruns für 004L.'],warnings:cfg.warnings};
  const radialSignedMm=operation.side==='outside'?cfg.radialAllowanceMm:operation.side==='inside'?-cfg.radialAllowanceMm:0;
  const roughDepthMm=Math.max(0,finalDepthMm-cfg.axialAllowanceMm);
  const roughRuns:CanonicalToolpathRun[]=[];
  if(roughDepthMm>EPS){
    let previousDepth=-1;
    for(const run of nominalRuns){
      const depth=Math.min(Math.abs(run.z),roughDepthMm);
      if(depth<=EPS||Math.abs(depth-previousDepth)<=EPS)continue;
      roughRuns.push(roughRun(run,radialSignedMm,-depth));
      previousDepth=depth;
      if(depth>=roughDepthMm-EPS)break;
    }
  }
  const finishRuns:CanonicalToolpathRun[]=[];
  if(cfg.finishPassEnabled){
    const nominalFinal=nominalRuns.reduce((best,run)=>run.z<best.z?run:best,nominalRuns[0]);
    for(let i=0;i<cfg.finishPassCount;i++)finishRuns.push({...nominalFinal,z:-finalDepthMm,points:nominalFinal.points.map(p=>({...p})),segments:nominalFinal.segments?.map(s=>s.kind==='line'?{kind:'line',start:{...s.start},end:{...s.end}}:{kind:'arc',start:{...s.start},end:{...s.end},center:{...s.center},ccw:s.ccw}),entrySegments:undefined,exitSegments:undefined});
  }
  const runs=[...roughRuns,...finishRuns];
  if(!runs.length)return{toolpath,errors:['004L erzeugte keine ausführbare Konturbahn.'],warnings:cfg.warnings};
  const warnings=[...cfg.warnings];
  if(cfg.radialAllowanceMm>EPS)warnings.push(`Radiales Schruppaufmaß: ${cfg.radialAllowanceMm.toFixed(3)} mm.`);
  if(cfg.axialAllowanceMm>EPS)warnings.push(`Axiales Schruppaufmaß: ${cfg.axialAllowanceMm.toFixed(3)} mm.`);
  if(cfg.finishPassEnabled)warnings.push(`Schlichtdurchgänge auf Sollmaß: ${cfg.finishPassCount}.`);
  return{toolpath:{...toolpath,runs},errors:[],warnings};
}
