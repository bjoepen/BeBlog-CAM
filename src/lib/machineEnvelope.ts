import type { CanonicalMachineMotion, CanonicalSpatialSegment, CanonicalToolpath, ToolpathPoint3 } from './canonicalToolpath';

export type MachineEnvelope={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number;warningMarginMm:number};
export type MachineWcsOrigin={x:number;y:number;z:number};
export type MachineEnvelopeHit={axis:'x'|'y'|'z';kind:'limit'|'margin';source:'run'|'entry'|'exit'|'motion'|'safe-z';machinePoint:ToolpathPoint3;value:number;min:number;max:number};
export type MachineEnvelopeResult={ok:boolean;errors:string[];warnings:string[];checkedPoints:number;hits:MachineEnvelopeHit[];usesExplicitMotions:boolean};

const finite=(...values:number[])=>values.every(Number.isFinite);
const toMachine=(point:ToolpathPoint3,origin:MachineWcsOrigin):ToolpathPoint3=>({x:origin.x+point.x,y:origin.y+point.y,z:origin.z+point.z});
const spatialPoints=(segment:CanonicalSpatialSegment):ToolpathPoint3[]=>[segment.start,segment.end];
const motionPoints=(motion:CanonicalMachineMotion):ToolpathPoint3[]=>[motion.start,motion.end];

export function validateMachineEnvelope(args:{toolpath:CanonicalToolpath;envelope:MachineEnvelope;wcsOrigin:MachineWcsOrigin;safeZMm:number}):MachineEnvelopeResult{
  const {toolpath,envelope,wcsOrigin,safeZMm}=args,errors:string[]=[],warnings:string[]=[],hits:MachineEnvelopeHit[]=[];
  if(!finite(envelope.minX,envelope.maxX,envelope.minY,envelope.maxY,envelope.minZ,envelope.maxZ,envelope.warningMarginMm,wcsOrigin.x,wcsOrigin.y,wcsOrigin.z,safeZMm)){
    return{ok:false,errors:['004S benötigt endliche Maschinenlimits, WCS-Maschinenposition und Sicherheits-Z.'],warnings:[],checkedPoints:0,hits:[],usesExplicitMotions:false};
  }
  if(!(envelope.maxX>envelope.minX&&envelope.maxY>envelope.minY&&envelope.maxZ>envelope.minZ))errors.push('004S benötigt positive X/Y/Z-Ausdehnung des Maschinenarbeitsraums.');
  if(envelope.warningMarginMm<0)errors.push('004S Warnabstand darf nicht negativ sein.');
  if(errors.length)return{ok:false,errors,warnings,checkedPoints:0,hits,usesExplicitMotions:false};

  const points:{point:ToolpathPoint3;source:MachineEnvelopeHit['source']}[]=[];
  const usesExplicitMotions=!!toolpath.motions?.length;
  if(usesExplicitMotions){
    for(const motion of toolpath.motions??[])for(const point of motionPoints(motion))points.push({point,source:'motion'});
  }else{
    toolpath.runs.forEach(run=>{
      run.points.forEach(point=>points.push({point:{x:point.x,y:point.y,z:run.z},source:'run'}));
      for(const segment of run.entrySegments??[])for(const point of spatialPoints(segment))points.push({point,source:'entry'});
      for(const segment of run.exitSegments??[])for(const point of spatialPoints(segment))points.push({point,source:'exit'});
    });
    warnings.push('004S: Keine vollständige canonical motions-Kette vorhanden; geprüft werden Runs sowie vorhandene Entry/Exit-Spatial-Motions.');
  }
  const safeProbe=points[0]?.point??{x:0,y:0,z:0};
  points.push({point:{x:safeProbe.x,y:safeProbe.y,z:safeZMm},source:'safe-z'});

  const checkAxis=(axis:'x'|'y'|'z',value:number,min:number,max:number,source:MachineEnvelopeHit['source'],machinePoint:ToolpathPoint3)=>{
    if(value<min-1e-9||value>max+1e-9){hits.push({axis,kind:'limit',source,machinePoint,value,min,max});return;}
    const margin=envelope.warningMarginMm;
    if(margin>0&&(value-min<margin-1e-9||max-value<margin-1e-9))hits.push({axis,kind:'margin',source,machinePoint,value,min,max});
  };

  for(const item of points){
    const machinePoint=toMachine(item.point,wcsOrigin);
    checkAxis('x',machinePoint.x,envelope.minX,envelope.maxX,item.source,machinePoint);
    checkAxis('y',machinePoint.y,envelope.minY,envelope.maxY,item.source,machinePoint);
    checkAxis('z',machinePoint.z,envelope.minZ,envelope.maxZ,item.source,machinePoint);
  }

  const limitHits=hits.filter(hit=>hit.kind==='limit'),marginHits=hits.filter(hit=>hit.kind==='margin');
  const uniqueLimitAxes=[...new Set(limitHits.map(hit=>hit.axis.toUpperCase()))];
  const uniqueMarginAxes=[...new Set(marginHits.map(hit=>hit.axis.toUpperCase()))];
  if(limitHits.length)errors.push(`Maschinenarbeitsraum überschritten: ${uniqueLimitAxes.join(', ')} (${limitHits.length} geprüfte Grenzverletzung${limitHits.length===1?'':'en'}).`);
  if(marginHits.length)warnings.push(`004S Warnabstand unterschritten: ${uniqueMarginAxes.join(', ')} (${marginHits.length} Punkt${marginHits.length===1?'':'e'}).`);
  return{ok:errors.length===0,errors,warnings,checkedPoints:points.length,hits,usesExplicitMotions};
}
