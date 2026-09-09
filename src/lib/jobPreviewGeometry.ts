import type { Curve2, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type JobPreviewPoint3={x:number;y:number;z:number};
export type JobPreviewGeometry={stockEdges:JobPreviewPoint3[][];partEdges:JobPreviewPoint3[][]};

const boxEdges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] as const;

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem){
  return{
    x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,
    y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,
    z:wcs.z==='top'?stock.thickness:0
  };
}
function toWcs(point:JobPreviewPoint3,stock:StockDefinition,wcs:WorkCoordinateSystem):JobPreviewPoint3{
  const origin=wcsOrigin(stock,wcs);
  return{x:point.x-origin.x,y:point.y-origin.y,z:point.z-origin.z};
}
function rotate(point:JobPreviewPoint3,orientation:PartOrientation):JobPreviewPoint3{
  const a=orientation.rotationZDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return{x:point.x*c-point.y*s,y:point.x*s+point.y*c,z:point.z};
}
function placementOffset(minX:number,maxX:number,minY:number,maxY:number,stock:StockDefinition,placement:PartPlacement){
  const width=maxX-minX,height=maxY-minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-width:(stock.width-width)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-height:(stock.height-height)/2;
  return{dx:tx-minX+placement.offsetX,dy:ty-minY+placement.offsetY};
}
function curvePoints(curve:Curve2){
  if(curve.kind==='line')return[curve.start,curve.end];
  if(curve.kind==='polyline')return curve.points;
  if(curve.kind==='circle')return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return{x:curve.center.x+Math.cos(a)*curve.radius,y:curve.center.y+Math.sin(a)*curve.radius};});
  if(curve.kind==='arc'){let a=curve.startAngleDeg,b=curve.endAngleDeg;while(b<a)b+=360;return Array.from({length:33},(_,i)=>{const r=(a+(b-a)*i/32)*Math.PI/180;return{x:curve.center.x+Math.cos(r)*curve.radius,y:curve.center.y+Math.sin(r)*curve.radius};});}
  return[];
}

export function buildJobPreviewGeometry(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem}):JobPreviewGeometry{
  const {summary,stock,stockMode,placement,orientation,wcs}=args;
  const stockCorners:JobPreviewPoint3[]=[
    {x:0,y:0,z:0},{x:stock.width,y:0,z:0},{x:stock.width,y:stock.height,z:0},{x:0,y:stock.height,z:0},
    {x:0,y:0,z:stock.thickness},{x:stock.width,y:0,z:stock.thickness},{x:stock.width,y:stock.height,z:stock.thickness},{x:0,y:stock.height,z:stock.thickness}
  ].map(point=>toWcs(point,stock,wcs));
  const stockEdges=stockMode==='none'?[]:boxEdges.map(([a,b])=>[stockCorners[a],stockCorners[b]]);

  if(summary.kind==='step'){
    const values=summary.brep?.displayVertices??[],raw:JobPreviewPoint3[]=[];
    for(let i=0;i+2<values.length;i+=3)raw.push(rotate({x:values[i],y:values[i+1],z:values[i+2]},orientation));
    if(!raw.length)return{stockEdges,partEdges:[]};
    const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y),zs=raw.map(p=>p.z),minZ=Math.min(...zs);
    const offset=placementOffset(Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys),stock,placement);
    const placed=raw.map(point=>toWcs({x:point.x+offset.dx,y:point.y+offset.dy,z:point.z-minZ+placement.offsetZ},stock,wcs));
    const partEdges:JobPreviewPoint3[][]=[];
    for(let i=0;i+2<placed.length;i+=3){partEdges.push([placed[i],placed[i+1]],[placed[i+1],placed[i+2]],[placed[i+2],placed[i]]);}
    return{stockEdges,partEdges};
  }

  const curves=summary.planarGeometry?.curves??[];
  const rotated=curves.map(curve=>curvePoints(curve).map(point=>rotate({...point,z:0},orientation)));
  const flat=rotated.flat();
  if(!flat.length)return{stockEdges,partEdges:[]};
  const xs=flat.map(p=>p.x),ys=flat.map(p=>p.y);
  const offset=stockMode==='none'?{dx:-Math.min(...xs)+placement.offsetX,dy:-Math.min(...ys)+placement.offsetY}:placementOffset(Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys),stock,placement);
  const partEdges=rotated.map(points=>points.map(point=>toWcs({x:point.x+offset.dx,y:point.y+offset.dy,z:placement.offsetZ},stock,wcs)));
  return{stockEdges,partEdges};
}
