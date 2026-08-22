import type { Point2 } from './types';

export type RectPocket = { minX:number; maxX:number; minY:number; maxY:number };
export type PocketMove = { x:number; y:number };
export type PocketPath = {
  ok:boolean;
  error?:string;
  pocket?:RectPocket;
  toolRadiusMm:number;
  stepoverMm:number;
  raster:Point2[];
  cleanup:Point2[];
  passesAcross:number;
};
export type CircularPocketPath={
  ok:boolean;
  error?:string;
  center:Point2;
  pocketRadiusMm:number;
  toolRadiusMm:number;
  maxCenterRadiusMm:number;
  requestedStepoverMm:number;
  actualStepoverMm:number;
  ringRadiiMm:number[];
};
export type PocketRamp = { ok:boolean; error?:string; lengthMm:number; availableMm:number; end?:Point2 };

const EPS=1e-6;
const near=(a:number,b:number,t=.01)=>Math.abs(a-b)<=t;

function normalizeClosed(points:Point2[]):Point2[]{
  if(points.length>1&&near(points[0].x,points[points.length-1].x)&&near(points[0].y,points[points.length-1].y))return points.slice(0,-1);
  return [...points];
}

export function detectAxisAlignedRectangle(points:Point2[],toleranceMm=.01):RectPocket|null{
  const pts=normalizeClosed(points);
  if(pts.length!==4)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  if(maxX-minX<=toleranceMm||maxY-minY<=toleranceMm)return null;
  const corners=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}];
  const matches=corners.every(c=>pts.some(p=>near(p.x,c.x,toleranceMm)&&near(p.y,c.y,toleranceMm)));
  if(!matches)return null;
  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length];
    const horizontal=near(a.y,b.y,toleranceMm),vertical=near(a.x,b.x,toleranceMm);
    if(!horizontal&&!vertical)return null;
  }
  return{minX,maxX,minY,maxY};
}

export function buildRectangularPocketPath(points:Point2[],toolDiameterMm:number,stepoverPercent:number):PocketPath{
  const toolRadiusMm=toolDiameterMm/2;
  const empty={ok:false,toolRadiusMm,stepoverMm:0,raster:[],cleanup:[],passesAcross:0};
  if(!(toolDiameterMm>0))return{...empty,error:'Werkzeugdurchmesser muss größer als 0 sein.'};
  if(!(stepoverPercent>0&&stepoverPercent<=100))return{...empty,error:'Seitliche Zustellung muss zwischen 0 und 100 % liegen.'};
  const pocket=detectAxisAlignedRectangle(points);
  if(!pocket)return{...empty,error:'Raster unterstützt nur geschlossene achsparallele Rechtecktaschen.'};
  const minX=pocket.minX+toolRadiusMm,maxX=pocket.maxX-toolRadiusMm,minY=pocket.minY+toolRadiusMm,maxY=pocket.maxY-toolRadiusMm;
  if(maxX-minX<=EPS||maxY-minY<=EPS)return{...empty,pocket,error:'Das Werkzeug passt nicht vollständig in die gewählte Tasche.'};
  const stepoverMm=toolDiameterMm*stepoverPercent/100,height=maxY-minY;
  const passesAcross=Math.max(1,Math.ceil(height/stepoverMm)+1),actualStep=passesAcross===1?0:height/(passesAcross-1);
  const raster:Point2[]=[];
  for(let i=0;i<passesAcross;i++){
    const y=i===passesAcross-1?maxY:minY+i*actualStep;
    if(i%2===0)raster.push({x:minX,y},{x:maxX,y}); else raster.push({x:maxX,y},{x:minX,y});
  }
  const cleanup:Point2[]=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY},{x:minX,y:minY}];
  return{ok:true,pocket,toolRadiusMm,stepoverMm:actualStep||stepoverMm,raster,cleanup,passesAcross};
}

export function buildCircularPocketPath(center:Point2,pocketRadiusMm:number,toolDiameterMm:number,stepoverPercent:number):CircularPocketPath{
  const toolRadiusMm=toolDiameterMm/2,requestedStepoverMm=toolDiameterMm*stepoverPercent/100;
  const empty={ok:false,center:{...center},pocketRadiusMm,toolRadiusMm,maxCenterRadiusMm:0,requestedStepoverMm,actualStepoverMm:0,ringRadiiMm:[]};
  if(!(pocketRadiusMm>0))return{...empty,error:'Kreistaschenradius muss größer als 0 sein.'};
  if(!(toolDiameterMm>0))return{...empty,error:'Werkzeugdurchmesser muss größer als 0 sein.'};
  if(!(stepoverPercent>0&&stepoverPercent<=100))return{...empty,error:'Seitliche Zustellung muss zwischen 0 und 100 % liegen.'};
  const maxCenterRadiusMm=pocketRadiusMm-toolRadiusMm;
  if(maxCenterRadiusMm<-EPS)return{...empty,error:'Das Werkzeug ist größer als die gewählte Kreistasche.'};
  if(maxCenterRadiusMm<=EPS)return{...empty,ok:true,maxCenterRadiusMm:0,actualStepoverMm:0,ringRadiiMm:[]};
  const ringCount=Math.max(1,Math.ceil(maxCenterRadiusMm/requestedStepoverMm));
  const actualStepoverMm=maxCenterRadiusMm/ringCount;
  const ringRadiiMm=Array.from({length:ringCount},(_,i)=>actualStepoverMm*(i+1));
  ringRadiiMm[ringRadiiMm.length-1]=maxCenterRadiusMm;
  return{...empty,ok:true,maxCenterRadiusMm,actualStepoverMm,ringRadiiMm};
}

export function buildPocketRamp(path:PocketPath,depthIncrementMm:number,angleDeg:number):PocketRamp{
  if(!path.ok||path.raster.length<2)return{ok:false,error:'Keine gültige Rasterbahn für die Rampe vorhanden.',lengthMm:0,availableMm:0};
  if(!(depthIncrementMm>0))return{ok:false,error:'Rampen-Zustellung muss größer als 0 sein.',lengthMm:0,availableMm:0};
  if(!(angleDeg>0&&angleDeg<90))return{ok:false,error:'Rampenwinkel muss zwischen 0° und 90° liegen.',lengthMm:0,availableMm:0};
  const a=path.raster[0],b=path.raster[1],dx=b.x-a.x,dy=b.y-a.y,availableMm=Math.hypot(dx,dy);
  const lengthMm=depthIncrementMm/Math.tan(angleDeg*Math.PI/180);
  if(lengthMm>availableMm+EPS)return{ok:false,error:`Rampe benötigt ${lengthMm.toFixed(3)} mm, auf der ersten Rasterbahn stehen aber nur ${availableMm.toFixed(3)} mm zur Verfügung.`,lengthMm,availableMm};
  const t=availableMm<=EPS?0:lengthMm/availableMm;
  return{ok:true,lengthMm,availableMm,end:{x:a.x+dx*t,y:a.y+dy*t}};
}
