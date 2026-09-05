import type { CurvedFaceTarget } from './curvedFaceTarget';
import { curvedFaceTargetZAt } from './curvedFaceTarget';

export type BallnoseContactPoint={
  surface:{x:number;y:number;z:number};
  center:{x:number;y:number;z:number};
  normal:{x:number;y:number;z:number};
};

export type BallnoseContactResult={
  valid:boolean;
  contact:BallnoseContactPoint|null;
  error:string|null;
};

const EPS=1e-7;

function normalize(v:{x:number;y:number;z:number}){
  const l=Math.hypot(v.x,v.y,v.z);
  if(l<=EPS)return null;
  return{x:v.x/l,y:v.y/l,z:v.z/l};
}

function estimateNormal(target:CurvedFaceTarget,x:number,y:number,sampleMm:number){
  const h=Math.max(.02,sampleMm);
  const z0=curvedFaceTargetZAt(target,x,y);
  if(z0===null)return null;

  const zx0=curvedFaceTargetZAt(target,x-h,y);
  const zx1=curvedFaceTargetZAt(target,x+h,y);
  const zy0=curvedFaceTargetZAt(target,x,y-h);
  const zy1=curvedFaceTargetZAt(target,x,y+h);

  let dzdx:number|null=null,dzdy:number|null=null;
  if(zx0!==null&&zx1!==null)dzdx=(zx1-zx0)/(2*h);
  else if(zx1!==null)dzdx=(zx1-z0)/h;
  else if(zx0!==null)dzdx=(z0-zx0)/h;

  if(zy0!==null&&zy1!==null)dzdy=(zy1-zy0)/(2*h);
  else if(zy1!==null)dzdy=(zy1-z0)/h;
  else if(zy0!==null)dzdy=(z0-zy0)/h;

  if(dzdx===null||dzdy===null)return null;
  return normalize({x:-dzdx,y:-dzdy,z:1});
}

export function ballnoseContactAt(
  target:CurvedFaceTarget,
  x:number,
  y:number,
  ballRadiusMm:number,
  normalSampleMm=.25,
):BallnoseContactResult{
  if(!target.valid)return{valid:false,contact:null,error:'Gekrümmte Zielfläche ist ungültig.'};
  if(!(ballRadiusMm>0))return{valid:false,contact:null,error:'Kugelradius muss größer als 0 sein.'};

  const z=curvedFaceTargetZAt(target,x,y);
  if(z===null)return{valid:false,contact:null,error:'XY liegt außerhalb der ausgewählten Zielfläche.'};

  const normal=estimateNormal(target,x,y,normalSampleMm);
  if(!normal)return{valid:false,contact:null,error:'Lokale Oberflächennormale konnte nicht stabil bestimmt werden.'};
  if(normal.z<=EPS)return{valid:false,contact:null,error:'Fläche ist lokal nicht von oben schlichbar.'};

  const surface={x,y,z};
  const center={
    x:x+normal.x*ballRadiusMm,
    y:y+normal.y*ballRadiusMm,
    z:z+normal.z*ballRadiusMm,
  };

  return{valid:true,contact:{surface,center,normal},error:null};
}
