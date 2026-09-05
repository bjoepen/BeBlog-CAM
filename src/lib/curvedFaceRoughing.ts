import type { ToolpathPoint2 } from './canonicalToolpath';
import type { CurvedFaceTarget } from './curvedFaceTarget';
import { curvedFaceTargetZAt } from './curvedFaceTarget';

export type CurvedFaceRoughingLevel={
  z:number;
  chains:{points:ToolpathPoint2[]}[];
};

export type CurvedFaceRoughingResult={
  valid:boolean;
  levels:CurvedFaceRoughingLevel[];
  errors:string[];
  warnings:string[];
  safePointCount:number;
};

const EPS=1e-6;

function toolDiskOffsets(radius:number){
  const rings=Math.max(2,Math.ceil(radius/.75));
  const offsets:{x:number;y:number}[]=[{x:0,y:0}];
  for(let ring=1;ring<=rings;ring++){
    const r=radius*ring/rings;
    const count=Math.max(12,Math.ceil(2*Math.PI*r/.6));
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2;
      offsets.push({x:Math.cos(a)*r,y:Math.sin(a)*r});
    }
  }
  return offsets;
}

/**
 * Flat-endmill safety test.
 *
 * The complete cutter-bottom disk must stay inside the selected face footprint
 * and at or above the curved target surface.
 */
function safeFlatEndAt(
  target:CurvedFaceTarget,
  x:number,
  y:number,
  levelZ:number,
  radius:number,
  allowance:number,
  offsets:{x:number;y:number}[],
){
  for(const offset of offsets){
    const surfaceZ=curvedFaceTargetZAt(target,x+offset.x,y+offset.y);
    if(surfaceZ===null)return false;
    if(levelZ<surfaceZ+allowance-EPS)return false;
  }
  return true;
}

export function buildCurvedFaceRoughing(
  target:CurvedFaceTarget,
  stockTopZ:number,
  toolDiameterMm:number,
  stepDownMm:number,
  stepoverPercent:number,
  finishAllowanceMm=0,
):CurvedFaceRoughingResult{
  const errors:string[]=[];
  const warnings:string[]=[];
  if(!target.valid||!target.bounds)errors.push('Gekrümmte Zielfläche ist nicht gültig.');
  if(!(toolDiameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(stepDownMm>0))errors.push('Zustellung muss größer als 0 sein.');
  if(!(stepoverPercent>0&&stepoverPercent<=100))errors.push('Stepover muss zwischen 0 und 100 % liegen.');
  if(!(finishAllowanceMm>=0))errors.push('Schlichtaufmaß darf nicht negativ sein.');
  if(errors.length)return{valid:false,levels:[],errors,warnings,safePointCount:0};

  const bounds=target.bounds!;
  const radius=toolDiameterMm/2;
  const stepover=Math.max(.05,toolDiameterMm*stepoverPercent/100);
  const sampleStep=Math.max(.15,Math.min(.6,toolDiameterMm/8));
  const diskOffsets=toolDiskOffsets(radius);

  const lowestTarget=bounds.minZ+finishAllowanceMm;
  const highestTarget=bounds.maxZ+finishAllowanceMm;
  const levels:number[]=[];
  for(let z=stockTopZ-stepDownMm;z>lowestTarget+EPS;z-=stepDownMm)levels.push(z);
  if(lowestTarget<stockTopZ-EPS&&(levels.length===0||Math.abs(levels[levels.length-1]-lowestTarget)>1e-4)){
    levels.push(lowestTarget);
  }

  const result:CurvedFaceRoughingLevel[]=[];
  let safePointCount=0;

  for(const z of levels){
    // Levels entirely above the highest point of the target are still valid:
    // they remove the material cap above the selected curved face.
    const chains:{points:ToolpathPoint2[]}[]=[];
    let row=0;

    for(let y=bounds.minY+radius;y<=bounds.maxY-radius+EPS;y+=stepover,row++){
      const segments:{a:number;b:number}[]=[];
      let start:number|null=null,last:number|null=null;

      for(let x=bounds.minX+radius;x<=bounds.maxX-radius+EPS;x+=sampleStep){
        const safe=safeFlatEndAt(target,x,y,z,radius,finishAllowanceMm,diskOffsets);
        if(safe){
          safePointCount++;
          if(start===null)start=x;
          last=x;
        }else if(start!==null&&last!==null){
          if(last-start>EPS)segments.push({a:start,b:last});
          start=last=null;
        }
      }
      if(start!==null&&last!==null&&last-start>EPS)segments.push({a:start,b:last});

      const ordered=row%2===0?segments:[...segments].reverse();
      for(const segment of ordered){
        chains.push({
          points:row%2===0
            ?[{x:segment.a,y},{x:segment.b,y}]
            :[{x:segment.b,y},{x:segment.a,y}],
        });
      }
    }

    if(chains.length)result.push({z,chains});
  }

  if(!result.length){
    errors.push('Für Werkzeug, Zustellung und ausgewählte Fläche konnte keine sichere Hohlkehlen-Schruppbahn erzeugt werden.');
  }
  if(highestTarget>=stockTopZ-EPS){
    warnings.push('Die gewählte Zielfläche reicht bis an oder über die Rohlingoberseite; oberste Schruppstufen können entfallen.');
  }

  return{
    valid:errors.length===0,
    levels:result,
    errors,
    warnings,
    safePointCount,
  };
}
