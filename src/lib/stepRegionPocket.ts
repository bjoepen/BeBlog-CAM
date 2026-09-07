import { buildRegionPocketToolpath } from './regionPocketToolpath';
import type { CanonicalToolpath } from './canonicalToolpath';
import type { StepPocketCandidate } from './stepPocketOperation';
import type { ImportSummary, PartOrientation, PartPlacement, PocketOperation, StockDefinition, WorkCoordinateSystem } from './types';

type P={x:number;y:number};
const rotate=(p:P,deg:number)=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c};};

export function buildStepRegionPocket(args:{summary:ImportSummary;stock:StockDefinition;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation;candidate:StepPocketCandidate;targetDepthMm:number;strategy:'concentric'|'parallel'}):{toolpath:CanonicalToolpath|null;errors:string[];warnings:string[]}{
  const {summary,stock,placement,orientation,wcs,operation,candidate,targetDepthMm,strategy}=args;
  const values=summary.brep?.displayVertices??[];
  if(!values.length)return{toolpath:null,errors:['STEP-Bauteil besitzt keine transformierbare Geometrie.'],warnings:[]};
  const rotated:P[]=[];for(let i=0;i+2<values.length;i+=3)rotated.push(rotate({x:values[i],y:values[i+1]},orientation.rotationZDeg));
  const xs=rotated.map(p=>p.x),ys=rotated.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),width=maxX-minX,height=maxY-minY;
  const targetX=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-width:(stock.width-width)/2;
  const targetY=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-height:(stock.height-height)/2;
  const dx=targetX-minX+placement.offsetX,dy=targetY-minY+placement.offsetY;
  const origin={x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2};
  const transform=(p:P)=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+dx-origin.x,y:q.y+dy-origin.y};};
  return buildRegionPocketToolpath({outer:candidate.outer.map(transform),islands:candidate.islands.map(loop=>loop.map(transform)),operation,targetDepthMm,strategy});
}
