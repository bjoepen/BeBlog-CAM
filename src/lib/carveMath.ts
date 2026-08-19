import type { Curve2, ImportSummary, CarveOperation } from './types';

export type CarveSegmentCheck = {
  id:number;
  kind:'line';
  lengthMm:number;
  layerName:string|null;
};

export type CarvePreflightResult = {
  ok:boolean;
  errors:string[];
  warnings:string[];
  segments:CarveSegmentCheck[];
  totalLengthMm:number;
  passes:number;
};

const length=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(b.x-a.x,b.y-a.y);

/**
 * Gate 6C is intentionally conservative: the first verified Carve path accepts
 * exact DXF LINE entities only. ARC/open polyline selection remains visible in
 * the UX, but is rejected here until its native interpolation is regression-tested.
 * This keeps the CBG fret-slot reference mathematically simple and auditable.
 */
export function validateCarveOperation(summary:ImportSummary,operation:CarveOperation):CarvePreflightResult{
  const errors:string[]=[],warnings:string[]=[];
  const segments:CarveSegmentCheck[]=[];
  if(summary.kind!=='dxf')errors.push('Carve ist in 001H Gate 6C zunächst nur für DXF freigegeben.');
  const curves=summary.planarGeometry?.curves??[];
  const layers=summary.planarGeometry?.curveLayers??[];
  const ids=[...new Set(operation.curveIds)].sort((a,b)=>a-b);
  if(ids.length===0)errors.push('Keine Carve-Geometrie ausgewählt.');
  if(ids.length!==operation.curveIds.length)errors.push('Die Carve-Auswahl enthält doppelte Geometrie-IDs.');

  for(const id of ids){
    const curve=curves[id];
    if(!curve){errors.push(`Geometrie ${id+1} existiert in der aktuellen DXF nicht.`);continue;}
    if(curve.kind!=='line'){
      const label=curve.kind==='arc'?'Bogen':curve.kind==='polyline'?'Polylinie':curve.kind==='circle'?'Kreis':'Geometrie';
      errors.push(`Geometrie ${id+1} (${label}) ist in Gate 6C noch nicht freigegeben. Der erste Carve-Referenzpfad verwendet exakte offene DXF-Linien.`);
      continue;
    }
    const len=length(curve.start,curve.end);
    if(!(len>1e-9)){errors.push(`Geometrie ${id+1} hat keine nutzbare Länge.`);continue;}
    segments.push({id,kind:'line',lengthMm:len,layerName:layers[id]??null});
  }

  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.totalDepthMm>0))errors.push('Gesamttiefe muss größer als 0 sein.');
  if(!(operation.stepDownMm>0))errors.push('Zustellung muss größer als 0 sein.');
  if(!(operation.feedMmMin>0&&operation.plungeMmMin>0&&operation.spindleRpm>0))errors.push('Vorschub, Eintauchvorschub und Drehzahl müssen größer als 0 sein.');
  if(!(operation.safeZMm>0))errors.push('Sicherheits-Z muss größer als 0 sein.');

  const passes=operation.stepDownMm>0&&operation.totalDepthMm>0?Math.ceil(operation.totalDepthMm/operation.stepDownMm):0;
  const totalLengthMm=segments.reduce((sum,s)=>sum+s.lengthMm,0);
  if(summary.kind==='dxf'&&operation.layerName){
    const outside=segments.filter(s=>s.layerName!==operation.layerName);
    if(outside.length)warnings.push(`${outside.length} manuell gewählte Geometrie${outside.length===1?' liegt':'n liegen'} außerhalb der ursprünglichen Ebene ${operation.layerName}. Maßgeblich bleibt die konkrete Auswahl.`);
  }
  return{ok:errors.length===0,errors,warnings,segments,totalLengthMm,passes};
}
