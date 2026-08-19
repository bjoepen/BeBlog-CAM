import type { ImportSummary, StockDefinition, StockMode, PartPlacement, PartOrientation, WorkCoordinateSystem, PocketOperation } from './types';
import { buildClosedChains, sampleCurve, type P2 } from './contourMath';
import { buildRectangularPocketPath } from './pocketMath';

export type PocketGcodeResult={
  ok:boolean;errors:string[];warnings:string[];code:string;lineCount:number;passes:number;toolRadiusMm:number;stepoverMm:number;rasterPasses:number;pointCount:number;
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
  return{x:wcs.x==='left'?b.minX:wcs.x==='right'?b.maxX:(b.minX+b.maxX)/2,y:wcs.y==='front'?b.minY:wcs.y==='back'?b.maxY:(b.minY+b.maxY)/2};
}

export function generatePocketGcode(args:{summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:PocketOperation}):PocketGcodeResult{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  const fail=(extra:string[]=[]):PocketGcodeResult=>({ok:false,errors:[...errors,...extra],warnings,code:'',lineCount:0,passes:0,toolRadiusMm:operation.tool.diameterMm/2,stepoverMm:0,rasterPasses:0,pointCount:0});
  if(summary.kind!=='dxf')errors.push('001H erzeugt Taschen-G-Code zunächst nur aus DXF.');
  if(operation.contourId===null)errors.push('Keine geschlossene Taschenkontur gewählt.');
  if(operation.entry!=='plunge')errors.push('Rampen-Eintauchen ist in 001H Gate 4 noch nicht freigegeben.');
  if(operation.tool.diameterMm<=0)errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if(operation.totalDepthMm<=0||operation.stepDownMm<=0)errors.push('Tiefe und Zustellung müssen größer als 0 sein.');
  if(operation.feedMmMin<=0||operation.plungeMmMin<=0||operation.spindleRpm<=0)errors.push('Schnittdaten sind unvollständig.');
  if(operation.safeZMm<=0)errors.push('Sicherheits-Z muss größer als 0 sein.');
  if(wcs.z!=='top')errors.push('WCS Unterseite ist für Taschen in 001H Gate 4 noch gesperrt.');
  if(stockMode==='none')warnings.push('Kein Rohling definiert: Material- und Kollisionsgrenzen sind nur eingeschränkt prüfbar.');
  if(errors.length)return fail();

  const t=placementTranslation(summary,stock,stockMode,placement,orientation);if(!t)return fail(['Bauteilgeometrie konnte nicht transformiert werden.']);
  const transform=(p:P2)=>{const q=rotate(p,orientation.rotationZDeg);return{x:q.x+t.dx,y:q.y+t.dy}};
  const chains=buildClosedChains(summary.planarGeometry?.curves??[],transform);
  const selected=chains.find(c=>c.id===operation.contourId);if(!selected)return fail(['Gewählte Taschenkontur wurde nicht gefunden.']);
  const pocket=buildRectangularPocketPath(selected.points,operation.tool.diameterMm,operation.stepoverPercent);
  if(!pocket.ok)return fail([pocket.error??'Taschenbahn konnte nicht erzeugt werden.']);

  const origin=wcsOrigin(stock,stockMode,wcs,t.partBounds);
  const toWcs=(p:P2)=>({x:p.x-origin.x,y:p.y-origin.y});
  const raster=pocket.raster.map(toWcs),cleanup=pocket.cleanup.map(toWcs);
  const passes=Math.max(1,Math.ceil(operation.totalDepthMm/operation.stepDownMm));
  const lines:string[]=[];
  lines.push('( BeBlog CAM 001H )');
  lines.push('( Rechtecktasche · Rasterraeumung + Wandumlauf )');
  lines.push(`( Werkzeug Ø${f3(operation.tool.diameterMm)} mm · Stepover ${f3(pocket.stepoverMm)} mm )`);
  lines.push('( Eintauchen: senkrecht )');
  lines.push('G21','G90','G17',`S${Math.round(operation.spindleRpm)} M3`,`G0 Z${f3(operation.safeZMm)}`);
  const start=raster[0]; lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
  for(let pass=1;pass<=passes;pass++){
    const depth=-Math.min(operation.totalDepthMm,pass*operation.stepDownMm);
    lines.push(`( Zustellung ${pass}/${passes} · Z${f3(depth)} )`);
    lines.push(`G1 Z${f3(depth)} F${Math.round(operation.plungeMmMin)}`);
    for(let i=1;i<raster.length;i++) lines.push(`G1 X${f3(raster[i].x)} Y${f3(raster[i].y)} F${Math.round(operation.feedMmMin)}`);
    const c0=cleanup[0];
    lines.push(`G1 X${f3(c0.x)} Y${f3(c0.y)} F${Math.round(operation.feedMmMin)}`);
    for(let i=1;i<cleanup.length;i++) lines.push(`G1 X${f3(cleanup[i].x)} Y${f3(cleanup[i].y)} F${Math.round(operation.feedMmMin)}`);
    lines.push(`G0 Z${f3(operation.safeZMm)}`);
    if(pass<passes)lines.push(`G0 X${f3(start.x)} Y${f3(start.y)}`);
  }
  lines.push('M5',`G0 Z${f3(operation.safeZMm)}`,'M30');
  const code=lines.join('\n')+'\n';
  return{ok:true,errors:[],warnings,code,lineCount:lines.length,passes,toolRadiusMm:pocket.toolRadiusMm,stepoverMm:pocket.stepoverMm,rasterPasses:pocket.passesAcross,pointCount:raster.length+cleanup.length};
}
