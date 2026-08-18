import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, ContourOperation, Curve2 } from './types';
import { buildClosedChains, offsetPolygon, validateOffsetSegments, sampleCurve, type P2 } from './contourMath';

export type InterpolationMode = 'g1-segmented' | 'g2g3-native-circle';

export type GcodeResult = {
  ok:boolean;
  errors:string[];
  warnings:string[];
  code:string;
  lineCount:number;
  pointCount:number;
  passes:number;
  radiusMm:number;
  interpolation:InterpolationMode;
  nativeArcCount:number;
  validation?:ReturnType<typeof validateOffsetSegments>;
};

const rotate=(p:P2,deg:number):P2=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}};
const bounds=(pts:P2[])=>{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)}};
const f3=(n:number)=>Math.abs(n)<.0005?'0.000':n.toFixed(3);

function placementTranslation(summary:ImportSummary,stock:StockDefinition,stockMode:StockMode,placement:PartPlacement,orientation:PartOrientation){
  const curves=summary.planarGeometry?.curves??[];
  const all=curves.flatMap(c=>sampleCurve(c).map(p=>rotate(p,orientation.rotationZDeg)));
  if(!all.length)return null;
  const b=bounds(all),w=b.maxX-b.minX,h=b.maxY-b.minY;
  if(stockMode==='none')return{dx:-b.minX,dy:-b.minY,partBounds:{minX:0,maxX:w,minY:0,maxY:h}};
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-w:(stock.width-w)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-h:(stock.height-h)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,partBounds:{minX:tx+placement.offsetX,maxX:tx+w+placement.offsetX,minY:ty+placement.offsetY,maxY:ty+h+placement.offsetY}};
}

function wcsOrigin(stock:StockDefinition,stockMode:StockMode,wcs:WorkCoordinateSystem,partBounds:{minX:number;maxX:number;minY:number;maxY:number}){
  const b=stockMode==='none'?partBounds:{minX:0,maxX:stock.width,minY:0,maxY:stock.height};
  return{
    x:wcs.x==='left'?b.minX:wcs.x==='right'?b.maxX:(b.minX+b.maxX)/2,
    y:wcs.y==='front'?b.minY:wcs.y==='back'?b.maxY:(b.minY+b.maxY)/2
  };
}

function nativeCircleForContour(curves:Curve2[], contourId:number, transform:(p:P2)=>P2){
  let id=0;
  for(const curve of curves){
    if(curve.kind==='circle'){
      if(id===contourId)return{center:transform(curve.center),radius:curve.radius};
      id++;
    }else if(curve.kind==='polyline'&&curve.closed){
      if(id===contourId)return null;
      id++;
    }
  }
  return null;
}

export function generateContourGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:ContourOperation}):GcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='dxf')errors.push('001G erzeugt G-Code zunächst nur aus DXF-Konturen.');
  if(operation.contourId===null)errors.push('Keine geschlossene Kontur gewählt.');
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(operation.totalDepthMm<=0)errors.push('Gesamttiefe muss größer als 0 sein.');
  if(operation.stepDownMm<=0)errors.push('Zustellung muss größer als 0 sein.');
  if(operation.feedMmMin<=0||operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Schnittdaten sind unvollständig.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');
  if(wcs.z!=='top')errors.push('G-Code mit WCS auf Unterseite ist in 001G noch gesperrt.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nicht vollständig prüfbar.');
  const t=placementTranslation(summary,stock,stockMode,placement,orientation);
  if(!t)errors.push('Bauteilgeometrie konnte nicht transformiert werden.');
  if(errors.length||!t)return{ok:false,errors,warnings,code:'',lineCount:0,pointCount:0,passes:0,radiusMm:operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0};

  const transform=(p:P2)=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx,y:q.y+t.dy}};
  const chains=buildClosedChains(summary.planarGeometry?.curves??[],transform);
  const selected=chains.find(c=>c.id===operation.contourId);
  if(!selected)return{ok:false,errors:['Gewählte Kontur wurde in der aktuellen Geometrie nicht gefunden.'],warnings,code:'',lineCount:0,pointCount:0,passes:0,radiusMm:operation.tool.diameterMm/2,interpolation:'g1-segmented',nativeArcCount:0};

  const radius=operation.tool.diameterMm/2;
  const correction=operation.side==='outside'?radius:operation.side==='inside'?-radius:0;
  let toolpath=offsetPolygon(selected.points,correction);
  const validation=validateOffsetSegments(selected.points,toolpath,correction,.002);
  if(!validation.ok)return{ok:false,errors:[`Werkzeugbahn hat die geometrische Prüfung nicht bestanden (max. Abweichung ${Number.isFinite(validation.maxDeviationMm)?validation.maxDeviationMm.toFixed(4):'—'} mm).`],warnings,code:'',lineCount:0,pointCount:toolpath.length,passes:0,radiusMm:radius,interpolation:'g1-segmented',nativeArcCount:0,validation};

  const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const nativeCircle=operation.contourId===null?null:nativeCircleForContour(summary.planarGeometry?.curves??[],operation.contourId,transform);
  const nativeCircleRadius=nativeCircle?nativeCircle.radius+correction:0;
  const useNativeCircle=!!nativeCircle&&nativeCircleRadius>0;
  if(nativeCircle&&nativeCircleRadius<=0){
    return{ok:false,errors:['Die Innenkorrektur ist für diese Kreis-Kontur größer oder gleich dem Kreisradius. Es existiert keine gültige Werkzeugmittelbahn.'],warnings,code:'',lineCount:0,pointCount:toolpath.length,passes:0,radiusMm:radius,interpolation:'g1-segmented',nativeArcCount:0,validation};
  }

  toolpath=toolpath.map(p=>({x:p.x-origin.x,y:p.y-origin.y}));
  if(operation.direction==='conventional')toolpath=[...toolpath].reverse();
  const passes=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm));
  const lines:string[]=[];
  const interpolation:InterpolationMode=useNativeCircle?'g2g3-native-circle':'g1-segmented';
  const nativeArcCount=useNativeCircle?passes*2:0;

  lines.push('( BeBlog CAM 001G )');
  lines.push('( Konturkoordinaten sind Sollgeometrie; Bahn ist radiuskorrigierte Fräsermittelbahn )');
  lines.push(`( Werkzeug Ø${f3(operation.tool.diameterMm)} mm · ${operation.side==='outside'?'Aussen':operation.side==='inside'?'Innen':'Auf Linie'} )`);
  lines.push(useNativeCircle?'( Interpolation: nativer Kreis als zwei G2/G3-Halbkreise )':'( Interpolation: G1-Referenzbahn; gemischte Bögen folgen in einem weiteren Gate )');
  lines.push('G21');
  lines.push('G90');
  lines.push('G17');
  lines.push(`S${Math.round(operation.spindleRpm)} M3`);
  lines.push(`G0 Z${f3(operation.safeZMm)}`);

  if(useNativeCircle&&nativeCircle){
    const center={x:nativeCircle.center.x-origin.x,y:nativeCircle.center.y-origin.y};
    const r=nativeCircleRadius;
    const start={x:center.x+r,y:center.y};
    const opposite={x:center.x-r,y:center.y};
    const arcCode=operation.direction==='conventional'?'G2':'G3';
    lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    for(let pass=1;pass<=passes;pass++){
      const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);
      lines.push(`( Zustellung ${pass}/${passes} · Z${f3(depth)} )`);
      lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);
      lines.push(`${arcCode} X${f3(opposite.x)} Y${f3(opposite.y)} I${f3(-r)} J0.000 F${Math.round(operation.feedMmMin)}`);
      lines.push(`${arcCode} X${f3(start.x)} Y${f3(start.y)} I${f3(r)} J0.000 F${Math.round(operation.feedMmMin)}`);
      lines.push(`G0 Z${f3(operation.safeZMm)}`);
      if(pass<passes)lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    }
  }else{
    const start=toolpath[0];
    lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    for(let pass=1;pass<=passes;pass++){
      const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);
      lines.push(`( Zustellung ${pass}/${passes} · Z${f3(depth)} )`);
      lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);
      for(let i=1;i<toolpath.length;i++)lines.push(`G1 X${f3(toolpath[i].x)} Y${f3(toolpath[i].y)} F${Math.round(operation.feedMmMin)}`);
      lines.push(`G0 Z${f3(operation.safeZMm)}`);
      if(pass<passes)lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
    }
  }

  lines.push('M5');
  lines.push(`G0 Z${f3(operation.safeZMm)}`);
  lines.push('M30');
  return{ok:true,errors,warnings,code:lines.join('\n'),lineCount:lines.length,pointCount:useNativeCircle?3:toolpath.length,passes,radiusMm:radius,interpolation,nativeArcCount,validation};
}
