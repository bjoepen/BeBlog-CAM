import type { ModelSliceLoop, ModelSliceRegion } from './modelSliceRegion';
import type { ZPoint2 } from './zLevelSlice';

export type StockRect={
  minX:number;
  minY:number;
  maxX:number;
  maxY:number;
};

export type RoughingRegionIsland={
  outer:ZPoint2[];
  holes:ZPoint2[][];
  source:'stock'|'model-void';
  depth:number;
};

export type RoughingRegion={
  z:number;
  valid:boolean;
  stock:StockRect;
  islands:RoughingRegionIsland[];
  modelLoopCount:number;
  errors:string[];
  warnings:string[];
};

const EPS=1e-7;

function pointOnSegment(p:ZPoint2,a:ZPoint2,b:ZPoint2){
  const cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
  if(Math.abs(cross)>1e-6)return false;
  const dot=(p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y);
  if(dot<-EPS)return false;
  const len2=(b.x-a.x)**2+(b.y-a.y)**2;
  return dot<=len2+EPS;
}

function pointInPolygon(points:ZPoint2[],p:ZPoint2){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    if(pointOnSegment(p,a,b))return true;
    const hit=((a.y>p.y)!==(b.y>p.y))&&
      p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x;
    if(hit)inside=!inside;
  }
  return inside;
}

function pointInsideStock(p:ZPoint2,stock:StockRect){
  return p.x>=stock.minX-EPS&&p.x<=stock.maxX+EPS&&
    p.y>=stock.minY-EPS&&p.y<=stock.maxY+EPS;
}

function stockLoop(stock:StockRect):ZPoint2[]{
  return[
    {x:stock.minX,y:stock.minY},
    {x:stock.maxX,y:stock.minY},
    {x:stock.maxX,y:stock.maxY},
    {x:stock.minX,y:stock.maxY},
  ];
}

function allModelLoops(region:ModelSliceRegion):ModelSliceLoop[]{
  return region.islands.flatMap(island=>[island.outer,...island.holes]);
}

function nearestContainingLoop(
  target:ModelSliceLoop,
  candidates:ModelSliceLoop[],
  desiredDepth:number,
):ModelSliceLoop|null{
  const p=target.points[0];
  const containing=candidates
    .filter(loop=>loop!==target&&loop.depth===desiredDepth&&loop.area>target.area+EPS)
    .filter(loop=>pointInPolygon(loop.points,p))
    .sort((a,b)=>a.area-b.area);
  return containing[0]??null;
}

/**
 * Exact planar boolean: stock minus model material on one Z plane.
 *
 * This kernel is topology-only. Tool radius, accessibility, rest material
 * and toolpath generation are later stages.
 */
export function buildRoughingRegion(
  model:ModelSliceRegion,
  stock:StockRect,
):RoughingRegion{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(!(stock.maxX-stock.minX>EPS)||!(stock.maxY-stock.minY>EPS)){
    errors.push('Rohling besitzt keine belastbare XY-Fläche.');
  }

  if(!model.valid){
    errors.push('Modellschnitt ist ungültig und darf nicht für Stock−Model verwendet werden.');
    errors.push(...model.errors.map(error=>`Modellschnitt: ${error}`));
  }

  const loops=allModelLoops(model);

  for(const [index,loop] of loops.entries()){
    if(!loop.points.length){
      errors.push(`Modellkontur ${index+1} enthält keine Punkte.`);
      continue;
    }
    if(loop.points.some(point=>!pointInsideStock(point,stock))){
      errors.push(`Modellkontur ${index+1} liegt teilweise außerhalb des Rohlings.`);
    }
  }

  if(errors.length){
    return{
      z:model.z,
      valid:false,
      stock,
      islands:[],
      modelLoopCount:loops.length,
      errors:[...new Set(errors)],
      warnings,
    };
  }

  const rootModelOuters=loops
    .filter(loop=>loop.depth===0)
    .sort((a,b)=>b.area-a.area);

  const islands:RoughingRegionIsland[]=[{
    outer:stockLoop(stock),
    holes:rootModelOuters.map(loop=>loop.points),
    source:'stock',
    depth:-1,
  }];

  for(const voidLoop of loops.filter(loop=>loop.depth%2===1).sort((a,b)=>a.depth-b.depth||b.area-a.area)){
    const childDepth=voidLoop.depth+1;
    const childMaterial=loops
      .filter(loop=>loop.depth===childDepth)
      .filter(loop=>nearestContainingLoop(loop,loops,voidLoop.depth)===voidLoop)
      .sort((a,b)=>b.area-a.area);

    islands.push({
      outer:voidLoop.points,
      holes:childMaterial.map(loop=>loop.points),
      source:'model-void',
      depth:voidLoop.depth,
    });
  }

  if(!loops.length){
    warnings.push('Auf dieser Z-Ebene liegt kein Modellmaterial im Rohling; der komplette Rohling ist Schruppbereich.');
  }

  return{
    z:model.z,
    valid:true,
    stock,
    islands,
    modelLoopCount:loops.length,
    errors:[],
    warnings,
  };
}

export function buildRoughingRegions(
  modelRegions:ModelSliceRegion[],
  stock:StockRect,
):RoughingRegion[]{
  return modelRegions.map(region=>buildRoughingRegion(region,stock));
}
