import type { CanonicalToolpath, CanonicalToolpathRun } from './canonicalToolpath';
import { buildPlanarRasterChains } from './planarRasterKernel';
import type { RoughingRegion } from './roughingRegion';

export type ModelRoughingOrigin={x:number;y:number;z:number};

export type ModelRoughingToolpathResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  levelCount:number;
  islandCount:number;
};

export function buildModelRoughingCanonicalToolpath(
  regions:RoughingRegion[],
  toolDiameterMm:number,
  stepoverPercent:number,
  origin:ModelRoughingOrigin,
):ModelRoughingToolpathResult{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!(toolDiameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(stepoverPercent>0&&stepoverPercent<=100))errors.push('Stepover muss größer als 0 und höchstens 100 % sein.');
  if(!regions.length)errors.push('Keine Stock−Model-Schruppregionen vorhanden.');

  const invalid=regions.filter(region=>!region.valid);
  if(invalid.length){
    errors.push(`${invalid.length} Schruppregion${invalid.length===1?' ist':'en sind'} ungültig.`);
    for(const region of invalid)for(const error of region.errors)errors.push(`Z ${region.z.toFixed(3)}: ${error}`);
  }

  if(errors.length)return{
    ok:false,toolpath:null,errors:[...new Set(errors)],warnings,levelCount:regions.length,islandCount:0,
  };

  const ordered=[...regions].sort((a,b)=>b.z-a.z);
  const runs:CanonicalToolpathRun[]=[];
  let islandCount=0;

  for(const region of ordered){
    for(const island of region.islands){
      islandCount++;
      const loops=[
        {points:island.outer},
        ...island.holes.map(points=>({points})),
      ];
      const chains=buildPlanarRasterChains(loops,toolDiameterMm,stepoverPercent);
      if(!chains.length){
        warnings.push(`Z ${region.z.toFixed(3)} · Schruppinsel ${islandCount}: kein werkzeugradius-sicherer Rasterpfad.`);
        continue;
      }
      for(const chain of chains){
        runs.push({
          kind:'cut',
          z:region.z-origin.z,
          points:chain.points.map(point=>({x:point.x-origin.x,y:point.y-origin.y})),
          retractAfter:true,
        });
      }
    }
  }

  if(!runs.length){
    errors.push('Aus den Stock−Model-Regionen konnte keine werkzeugradius-sichere Schnittbahn erzeugt werden.');
    return{ok:false,toolpath:null,errors,warnings,levelCount:ordered.length,islandCount};
  }

  return{
    ok:true,
    toolpath:{
      version:1,
      operationKind:'z-level-roughing',
      strategy:'raster',
      tool:{diameterMm:toolDiameterMm},
      stepoverPercent,
      runs,
    },
    errors:[],
    warnings,
    levelCount:ordered.length,
    islandCount,
  };
}
