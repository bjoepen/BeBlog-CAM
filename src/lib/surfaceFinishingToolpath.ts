import type { CanonicalMachineMotion, CanonicalToolpath, ToolpathPoint3 } from './canonicalToolpath';
import type { CurvedFaceTarget } from './curvedFaceTarget';
import { ballnoseContactAt } from './ballnoseSurfaceContact';
import type { SurfaceFinishingOperation } from './types';

export type SurfaceFinishingOrigin={x:number;y:number;z:number};

export type SurfaceFinishingToolpathResult={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  chainCount:number;
  contactPointCount:number;
};

const EPS=1e-7;
type Chain={points:ToolpathPoint3[]};

function worldToWcs(p:ToolpathPoint3,origin:SurfaceFinishingOrigin):ToolpathPoint3{
  return{x:p.x-origin.x,y:p.y-origin.y,z:p.z-origin.z};
}

function buildStayDownLink(
  target:CurvedFaceTarget,
  from:ToolpathPoint3,
  to:ToolpathPoint3,
  radius:number,
  stepover:number,
  sampleStep:number,
):ToolpathPoint3[]|null{
  const distance=Math.hypot(to.x-from.x,to.y-from.y);

  // Stay-down is intentionally local. A valid path across the same surface
  // can still be a poor finishing link if it is too long.
  const maxLinkDistance=Math.max(stepover*2.5,sampleStep*2.5);
  if(!(distance>EPS)||distance>maxLinkDistance)return null;

  const steps=Math.max(2,Math.ceil(distance/Math.max(.08,Math.min(sampleStep,stepover)/2)));
  const points:ToolpathPoint3[]=[];

  for(let i=1;i<steps;i++){
    const t=i/steps;
    const x=from.x+(to.x-from.x)*t;
    const y=from.y+(to.y-from.y)*t;
    const contact=ballnoseContactAt(target,x,y,radius);
    if(!contact.valid||!contact.contact)return null;
    points.push(contact.contact.center);
  }

  return points;
}

export function buildSurfaceFinishingCanonicalToolpath(
  target:CurvedFaceTarget,
  operation:SurfaceFinishingOperation,
  origin:SurfaceFinishingOrigin,
):SurfaceFinishingToolpathResult{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!target.valid||!target.bounds)errors.push('Gekrümmte STEP-Zielfläche ist nicht gültig.');
  if(operation.tool.kind!=='ball-nose')errors.push('3D Schlichten benötigt einen Vollradiusfräser.');
  if(!(operation.tool.diameterMm>0))errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(!(operation.stepoverPercent>0&&operation.stepoverPercent<=100))errors.push('Stepover muss zwischen 0 und 100 % liegen.');

  if(errors.length)return{ok:false,toolpath:null,errors,warnings,chainCount:0,contactPointCount:0};

  const bounds=target.bounds!;
  const radius=operation.tool.diameterMm/2;
  const stepover=Math.max(.05,operation.tool.diameterMm*operation.stepoverPercent/100);
  const sampleStep=Math.max(.12,Math.min(.45,operation.tool.diameterMm/8));
  const alongX=operation.direction==='x';

  const primaryMin=alongX?bounds.minX:bounds.minY;
  const primaryMax=alongX?bounds.maxX:bounds.maxY;
  const secondaryMin=alongX?bounds.minY:bounds.minX;
  const secondaryMax=alongX?bounds.maxY:bounds.maxX;

  const chains:Chain[]=[];
  let row=0;
  let skippedRows=0;

  for(let secondary=secondaryMin;secondary<=secondaryMax+EPS;secondary+=stepover,row++){
    const rowChains:Chain[]=[];
    let current:ToolpathPoint3[]=[];

    for(let primary=primaryMin;primary<=primaryMax+EPS;primary+=sampleStep){
      const x=alongX?primary:secondary;
      const y=alongX?secondary:primary;
      const result=ballnoseContactAt(target,x,y,radius);

      if(!result.valid||!result.contact){
        if(current.length>=2)rowChains.push({points:current});
        current=[];
        continue;
      }
      current.push(result.contact.center);
    }

    if(current.length>=2)rowChains.push({points:current});
    if(!rowChains.length){
      skippedRows++;
      continue;
    }

    const ordered=row%2===0?rowChains:[...rowChains].reverse();
    for(const chain of ordered){
      chains.push({points:row%2===0?[...chain.points]:[...chain.points].reverse()});
    }
  }

  if(!chains.length){
    errors.push('Aus der gewählten Fläche konnte keine kompensierte Ballnose-Schlichtbahn erzeugt werden.');
    return{ok:false,toolpath:null,errors,warnings,chainCount:0,contactPointCount:0};
  }

  if(skippedRows)warnings.push(`${skippedRows} Rasterzeile${skippedRows===1?'':'n'} enthielt${skippedRows===1?'':'en'} keine gültigen Ballnose-Kontaktpunkte.`);

  const motions:CanonicalMachineMotion[]=[];
  let contactPointCount=0;
  let previousWorldEnd:ToolpathPoint3|null=null;
  let previousWcsEnd:ToolpathPoint3|null=null;
  let cutterAtSafe=true;

  for(const chain of chains){
    if(chain.points.length<2)continue;

    const worldPoints=chain.points;
    const points=worldPoints.map(point=>worldToWcs(point,origin));
    contactPointCount+=points.length;

    const firstWorld=worldPoints[0];
    const lastWorld=worldPoints[worldPoints.length-1];
    const first=points[0];
    const last=points[points.length-1];
    const startSafe:ToolpathPoint3={x:first.x,y:first.y,z:operation.safeZMm};
    const endSafe:ToolpathPoint3={x:last.x,y:last.y,z:operation.safeZMm};

    let linkedStayDown=false;

    if(previousWorldEnd&&previousWcsEnd&&!cutterAtSafe){
      const linkWorld=buildStayDownLink(target,previousWorldEnd,firstWorld,radius,stepover,sampleStep);
      if(linkWorld){
        let cursor=previousWcsEnd;
        for(const worldPoint of linkWorld){
          const next=worldToWcs(worldPoint,origin);
          motions.push({kind:'line3',start:cursor,end:next,feedMmMin:operation.feedMmMin});
          cursor=next;
        }
        motions.push({kind:'line3',start:cursor,end:first,feedMmMin:operation.feedMmMin});
        linkedStayDown=true;
      }
    }

    if(!linkedStayDown){
      if(previousWcsEnd&&!cutterAtSafe){
        const previousSafe:ToolpathPoint3={x:previousWcsEnd.x,y:previousWcsEnd.y,z:operation.safeZMm};
        motions.push({kind:'rapid3',start:previousWcsEnd,end:previousSafe});
        motions.push({kind:'rapid3',start:previousSafe,end:startSafe});
      }else if(previousWcsEnd&&cutterAtSafe){
        const previousSafe:ToolpathPoint3={x:previousWcsEnd.x,y:previousWcsEnd.y,z:operation.safeZMm};
        motions.push({kind:'rapid3',start:previousSafe,end:startSafe});
      }

      motions.push({
        kind:'line3',
        start:startSafe,
        end:first,
        feedMmMin:operation.plungeMmMin,
      });
      cutterAtSafe=false;
    }

    for(let i=1;i<points.length;i++){
      motions.push({
        kind:'line3',
        start:points[i-1],
        end:points[i],
        feedMmMin:operation.feedMmMin,
      });
    }

    previousWorldEnd=lastWorld;
    previousWcsEnd=last;
  }

  if(previousWcsEnd&&!cutterAtSafe){
    const finalSafe:ToolpathPoint3={x:previousWcsEnd.x,y:previousWcsEnd.y,z:operation.safeZMm};
    motions.push({kind:'rapid3',start:previousWcsEnd,end:finalSafe});
  }

  return{
    ok:true,
    toolpath:{
      version:1,
      operationKind:'surface-finishing',
      strategy:'parallel-surface',
      tool:{diameterMm:operation.tool.diameterMm},
      stepoverPercent:operation.stepoverPercent,
      runs:[],
      motions,
    },
    errors:[],
    warnings,
    chainCount:chains.length,
    contactPointCount,
  };
}
