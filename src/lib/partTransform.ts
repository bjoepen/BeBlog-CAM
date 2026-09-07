import type { ImportSummary, PartOrientation, PartPlacement, Point2, StockDefinition, StockMode, WorkCoordinateSystem } from './types';
import { sampleCurve } from './contourMath';

export type PlanarBounds={minX:number;maxX:number;minY:number;maxY:number};
export type PlanarPlacementTransform={
  bounds:PlanarBounds;
  placedBounds:PlanarBounds;
  dx:number;
  dy:number;
  rotate:(point:Point2)=>Point2;
  toStock:(point:Point2)=>Point2;
  wcsOrigin:(wcs:WorkCoordinateSystem)=>Point2;
  toWcs:(point:Point2,wcs:WorkCoordinateSystem)=>Point2;
};

export function rotatePlanarPoint(point:Point2,orientation:PartOrientation):Point2{
  const angle=orientation.rotationZDeg*Math.PI/180;
  const c=Math.cos(angle),s=Math.sin(angle);
  return{x:point.x*c-point.y*s,y:point.x*s+point.y*c};
}

export function planarBounds(points:Point2[]):PlanarBounds|null{
  if(!points.length)return null;
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
}

export function resolvePlanarPartTransform(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  stockMode:StockMode;
  placement:PartPlacement;
  orientation:PartOrientation;
}):PlanarPlacementTransform|null{
  const {summary,stock,stockMode,placement,orientation}=args;
  const curves=summary.planarGeometry?.curves??[];
  const rotatedPoints=curves.flatMap(curve=>sampleCurve(curve).map(point=>rotatePlanarPoint(point,orientation)));
  const bounds=planarBounds(rotatedPoints);
  if(!bounds)return null;

  const width=bounds.maxX-bounds.minX;
  const height=bounds.maxY-bounds.minY;
  const targetX=stockMode==='none'
    ?0
    :placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-width:(stock.width-width)/2;
  const targetY=stockMode==='none'
    ?0
    :placement.vertical==='front'?0:placement.vertical==='back'?stock.height-height:(stock.height-height)/2;
  const offsetX=stockMode==='none'?0:placement.offsetX;
  const offsetY=stockMode==='none'?0:placement.offsetY;
  const dx=targetX-bounds.minX+offsetX;
  const dy=targetY-bounds.minY+offsetY;
  const placedBounds={minX:bounds.minX+dx,maxX:bounds.maxX+dx,minY:bounds.minY+dy,maxY:bounds.maxY+dy};

  const rotate=(point:Point2)=>rotatePlanarPoint(point,orientation);
  const toStock=(point:Point2)=>{const rotated=rotate(point);return{x:rotated.x+dx,y:rotated.y+dy}};
  const wcsOrigin=(wcs:WorkCoordinateSystem)=>{
    const reference=stockMode==='none'?placedBounds:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};
    return{
      x:wcs.x==='left'?reference.minX:wcs.x==='right'?reference.maxX:(reference.minX+reference.maxX)/2,
      y:wcs.y==='front'?reference.minY:wcs.y==='back'?reference.maxY:(reference.minY+reference.maxY)/2,
    };
  };
  const toWcs=(point:Point2,wcs:WorkCoordinateSystem)=>{
    const placed=toStock(point),origin=wcsOrigin(wcs);
    return{x:placed.x-origin.x,y:placed.y-origin.y};
  };

  return{bounds,placedBounds,dx,dy,rotate,toStock,wcsOrigin,toWcs};
}
