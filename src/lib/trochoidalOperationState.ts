import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem } from './types';
import type { TrochoidalContourContract } from './trochoidalContourContract';
import { validateTrochoidalContourContract } from './trochoidalContourContract';
import { buildTrochoidalContourGuide } from './trochoidalContourGuide';
import { buildTrochoidalCanonicalToolpath, type TrochoidalCanonicalToolpathResult } from './trochoidalCanonicalToolpath';
import { sampleCurve, type P2 } from './contourMath';

type Args={summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:TrochoidalContourContract};
export type TrochoidalOperationState=TrochoidalCanonicalToolpathResult&{warnings:string[]};

const rotate=(p:P2,deg:number):P2=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};

function transformFor(args:Args):((p:P2)=>P2)|null{
  const curves=args.summary.planarGeometry?.curves??[];
  const all=curves.flatMap(c=>sampleCurve(c).map(p=>rotate(p,args.orientation.rotationZDeg)));
  if(!all.length)return null;
  const b=bounds(all),w=b.maxX-b.minX,h=b.maxY-b.minY;
  const tx=args.stockMode==='none'?0:args.placement.horizontal==='left'?0:args.placement.horizontal==='right'?args.stock.width-w:(args.stock.width-w)/2;
  const ty=args.stockMode==='none'?0:args.placement.vertical==='front'?0:args.placement.vertical==='back'?args.stock.height-h:(args.stock.height-h)/2;
  const dx=tx-b.minX+args.placement.offsetX,dy=ty-b.minY+args.placement.offsetY;
  const partBounds={minX:tx+args.placement.offsetX,maxX:tx+w+args.placement.offsetX,minY:ty+args.placement.offsetY,maxY:ty+h+args.placement.offsetY};
  const wb=args.stockMode==='none'?partBounds:{minX:0,maxX:args.stock.width,minY:0,maxY:args.stock.height};
  const origin={x:args.wcs.x==='left'?wb.minX:args.wcs.x==='right'?wb.maxX:(wb.minX+wb.maxX)/2,
    y:args.wcs.y==='front'?wb.minY:args.wcs.y==='back'?wb.maxY:(wb.minY+wb.maxY)/2};
  return p=>{const q=rotate(p,args.orientation.rotationZDeg);return{x:q.x+dx-origin.x,y:q.y+dy-origin.y}};
}

/** F7: production adapter from a persisted operation contract to the accepted F6 canonical toolpath. */
export function buildTrochoidalContourOperationState(args:Args):TrochoidalOperationState{
  const errors:string[]=[],warnings:string[]=[];
  const contract=validateTrochoidalContourContract(args.operation);
  errors.push(...contract.errors);warnings.push(...contract.warnings);
  if(args.summary.kind!=='dxf')errors.push('Wirbelfräsen Kontur F7 ist zunächst ausschließlich für DXF freigegeben.');
  if(args.wcs.z!=='top')errors.push('Wirbelfräsen Kontur F7 benötigt Z-Null auf der Rohlingoberseite.');
  if(args.stockMode==='none')warnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nicht vollständig prüfbar.');
  const transform=transformFor(args);
  if(!transform)errors.push('Bauteilgeometrie konnte für Wirbelfräsen nicht transformiert werden.');
  if(errors.length||!transform)return{ok:false,toolpath:null,errors,warnings};
  const guide=buildTrochoidalContourGuide(args.summary.planarGeometry?.curves??[],args.operation,transform);
  if(!guide.ok)return{ok:false,toolpath:null,errors:guide.errors,warnings};
  const loop={radiusMm:args.operation.trochoidRadiusMm,forwardStepMm:args.operation.forwardStepMm,
    loopDirection:args.operation.direction==='climb'?'cw' as const:'ccw' as const};
  const result=buildTrochoidalCanonicalToolpath(guide.guide,loop,args.operation.tool.diameterMm/2,args.operation.id,{
    allowFullWidthStartup:true,totalDepthMm:args.operation.totalDepthMm,stepDownMm:args.operation.stepDownMm,
    safeZMm:args.operation.safeZMm,rapidFeedMmMin:Math.max(args.operation.feedMmMin,args.operation.plungeMmMin),
    maximumRampAngleDeg:args.operation.rampAngleDeg,rampFeedMmMin:args.operation.plungeMmMin,
    startupFeedMmMin:args.operation.feedMmMin,seedExtraRadiusMm:.1,
    bootstrapStepMm:Math.min(args.operation.forwardStepMm,args.operation.tool.diameterMm/2),
    allowedExposedAngleDeg:140
  });
  return result.ok?{...result,warnings}:{...result,warnings};
}
