import type { CanonicalMachineMotion, CanonicalToolpath, ToolpathPoint3 } from './canonicalToolpath';
import { buildCanonicalHelicalDescent } from './helicalMotion';
import { buildStepManufacturingFeatureSource } from './stepManufacturingFeatures';
import { recognizeStepHoles, type StepHoleFeature } from './stepHoleRecognition';
import type { DrillOperation, ImportSummary, PartOrientation, PartPlacement, StockDefinition, StockMode, WorkCoordinateSystem } from './types';

export type StepDrillOperationState={
  ok:boolean;
  toolpath:CanonicalToolpath|null;
  errors:string[];
  warnings:string[];
  holes:StepHoleFeature[];
};

type P3={x:number;y:number;z:number};
const EPS=1e-6;
const rotateZ=(p:P3,deg:number):P3=>{const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};
const bounds=(points:P3[])=>({
  minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
  minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),
  minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z)),
});

function placementTransform(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation){
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(rotateZ({x:values[i],y:values[i+1],z:values[i+2]},orientation.rotationZDeg));
  if(!raw.length)return null;
  const b=bounds(raw),width=b.maxX-b.minX,height=b.maxY-b.minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-width:(stock.width-width)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-height:(stock.height-height)/2;
  return{dx:tx-b.minX+placement.offsetX,dy:ty-b.minY+placement.offsetY,dz:-b.minZ+placement.offsetZ};
}

function wcsOrigin(stock:StockDefinition,wcs:WorkCoordinateSystem):P3{return{
  x:wcs.x==='left'?0:wcs.x==='right'?stock.width:stock.width/2,
  y:wcs.y==='front'?0:wcs.y==='back'?stock.height:stock.height/2,
  z:wcs.z==='top'?stock.thickness:0,
};}

function machinePoint(tuple:[number,number,number],orientation:PartOrientation,transform:{dx:number;dy:number;dz:number},origin:P3):P3{
  const r=rotateZ({x:tuple[0],y:tuple[1],z:tuple[2]},orientation.rotationZDeg);
  return{x:r.x+transform.dx-origin.x,y:r.y+transform.dy-origin.y,z:r.z+transform.dz-origin.z};
}

function appendAxialHole(motions:CanonicalMachineMotion[],state:ToolpathPoint3,hole:StepHoleFeature,top:P3,bottom:P3,operation:DrillOperation):ToolpathPoint3{
  const center={x:(top.x+bottom.x)/2,y:(top.y+bottom.y)/2};
  const rapidXY={x:center.x,y:center.y,z:operation.safeZMm};
  motions.push({kind:'rapid3',start:{...state},end:{...rapidXY}});state=rapidXY;
  if(top.z<state.z-EPS){const entry={x:center.x,y:center.y,z:top.z};motions.push({kind:'line3',start:{...state},end:{...entry},feedMmMin:operation.plungeMmMin});state=entry;}
  const depth=top.z-bottom.z,passes=Math.max(1,Math.ceil(depth/operation.stepDownMm));
  for(let pass=1;pass<=passes;pass++){
    const z=top.z-Math.min(depth,pass*operation.stepDownMm),end={x:center.x,y:center.y,z};
    motions.push({kind:'line3',start:{...state},end,feedMmMin:operation.plungeMmMin});state=end;
    if(pass<passes){const retract={x:center.x,y:center.y,z:top.z};motions.push({kind:'rapid3',start:{...state},end:{...retract}});state=retract;}
  }
  const safe={x:center.x,y:center.y,z:operation.safeZMm};motions.push({kind:'rapid3',start:{...state},end:{...safe}});return safe;
}

function appendHelicalHole(motions:CanonicalMachineMotion[],state:ToolpathPoint3,hole:StepHoleFeature,top:P3,bottom:P3,operation:DrillOperation):ToolpathPoint3{
  const center={x:(top.x+bottom.x)/2,y:(top.y+bottom.y)/2};
  const pathRadius=hole.diameterMm/2-operation.tool.diameterMm/2;
  const right={x:center.x+pathRadius,y:center.y,z:top.z};
  const rapid={x:right.x,y:right.y,z:operation.safeZMm};
  motions.push({kind:'rapid3',start:{...state},end:{...rapid}});state=rapid;
  if(top.z<state.z-EPS){motions.push({kind:'line3',start:{...state},end:{...right},feedMmMin:operation.plungeMmMin});state=right;}

  const helix=buildCanonicalHelicalDescent({centerX:center.x,centerY:center.y,radiusMm:pathRadius,startZ:top.z,targetZ:bottom.z,pitchMm:operation.stepDownMm,feedMmMin:operation.feedMmMin});
  if(!helix.ok)throw new Error(helix.error??`${hole.featureId}: Helix konnte nicht erzeugt werden.`);
  motions.push(...helix.segments);state={...helix.segments[helix.segments.length-1].end};

  const left={x:center.x-pathRadius,y:center.y,z:bottom.z};
  const rightBottom={x:center.x+pathRadius,y:center.y,z:bottom.z};
  motions.push({kind:'arc3',start:{...state},end:left,center:{...center},ccw:true,feedMmMin:operation.feedMmMin});state=left;
  motions.push({kind:'arc3',start:{...state},end:rightBottom,center:{...center},ccw:true,feedMmMin:operation.feedMmMin});state=rightBottom;
  const safe={x:rightBottom.x,y:rightBottom.y,z:operation.safeZMm};motions.push({kind:'rapid3',start:{...state},end:{...safe}});return safe;
}

export function buildStepDrillOperationState(args:{
  summary:ImportSummary;stock:StockDefinition;stockMode:StockMode;placement:PartPlacement;orientation:PartOrientation;wcs:WorkCoordinateSystem;operation:DrillOperation;
}):StepDrillOperationState{
  const {summary,stock,stockMode,placement,orientation,wcs,operation}=args;
  const errors:string[]=[],warnings:string[]=[];
  if(summary.kind!=='step')errors.push('STEP-Bohren benötigt einen STEP/BRep-Import.');
  if(stockMode==='none')errors.push('STEP-Bohren benötigt einen definierten Rohling.');
  if(wcs.z!=='top')errors.push('STEP-Bohren ist aktuell nur mit Z-Null auf der Rohlingoberseite freigegeben.');
  if(Math.abs(orientation.rotationXDeg)>EPS||Math.abs(orientation.rotationYDeg)>EPS)errors.push('STEP-Bohren unterstützt aktuell nur Bauteilorientierung ohne X/Y-Kippung.');
  if(operation.stepDownMm<=0||operation.plungeMmMin<=0||operation.safeZMm<=0)errors.push('Zustellung, Eintauchvorschub und Sicherheits-Z müssen größer als 0 sein.');
  if(operation.tool.diameterMm<=0||operation.spindleRpm<=0)errors.push('Werkzeugdurchmesser und Drehzahl müssen größer als 0 sein.');
  if(operation.method==='helical-mill'&&operation.feedMmMin<=0)errors.push('Helixvorschub muss größer als 0 sein.');

  const sourceResult=buildStepManufacturingFeatureSource(summary);
  if(!sourceResult.ok){errors.push(...sourceResult.errors);return{ok:false,toolpath:null,errors,warnings,holes:[]};}
  const recognized=recognizeStepHoles(sourceResult.source);
  if(!recognized.holes.length)errors.push('Im STEP/BRep wurden keine sicher erkannten Bohrungen gefunden.');
  const requestedIds=operation.stepHoleFeatureIds??[];
  if(!requestedIds.length)errors.push('Keine STEP-Bohrung explizit gewählt. Wähle mindestens eine erkannte Bohrung im Viewport.');
  const selectedIds=requestedIds;
  const byId=new Map(recognized.holes.map(h=>[h.featureId,h]));
  const holes=selectedIds.flatMap(id=>byId.get(id)?[byId.get(id)!]:[]);
  if(holes.length!==selectedIds.length)errors.push('Mindestens eine ausgewählte STEP-Bohrung ist im aktuellen BRep nicht mehr verfügbar.');
  for(const hole of holes){
    if(Math.abs(Math.abs(hole.axisDirection[2])-1)>1e-5)errors.push(`${hole.featureId}: Bohrungsachse ist nicht parallel zur Maschinen-Z-Achse.`);
    if(operation.method==='helical-mill'){
      if(operation.tool.diameterMm>=hole.diameterMm-EPS)errors.push(`${hole.featureId}: Für Helixfräsen muss Werkzeug Ø ${operation.tool.diameterMm.toFixed(3)} mm kleiner als Bohrungs-Ø ${hole.diameterMm.toFixed(3)} mm sein.`);
    }else if(operation.tool.diameterMm>hole.diameterMm+EPS)errors.push(`${hole.featureId}: Werkzeug Ø ${operation.tool.diameterMm.toFixed(3)} mm ist größer als Bohrungs-Ø ${hole.diameterMm.toFixed(3)} mm.`);
  }
  if(errors.length)return{ok:false,toolpath:null,errors,warnings,holes};

  const transform=placementTransform(summary,stock,placement,orientation);
  if(!transform)return{ok:false,toolpath:null,errors:['STEP-Bauteil konnte nicht in den Maschinenraum transformiert werden.'],warnings,holes};
  const origin=wcsOrigin(stock,wcs);
  const motions:CanonicalMachineMotion[]=[];
  let state:ToolpathPoint3={x:0,y:0,z:operation.safeZMm};
  try{
    for(const hole of holes){
      const a=machinePoint(hole.startCenter,orientation,transform,origin),b=machinePoint(hole.endCenter,orientation,transform,origin);
      const top=a.z>=b.z?a:b,bottom=a.z>=b.z?b:a;
      state=operation.method==='helical-mill'
        ?appendHelicalHole(motions,state,hole,top,bottom,operation)
        :appendAxialHole(motions,state,hole,top,bottom,operation);
    }
  }catch(error){return{ok:false,toolpath:null,errors:[String(error)],warnings,holes};}

  const toolpath:CanonicalToolpath={version:1,operationKind:'drill',strategy:operation.method==='helical-mill'?'helical-bore':'drill',tool:{diameterMm:operation.tool.diameterMm},stepoverPercent:0,runs:[],motions};
  if(recognized.rejectedCylinderFaceIds.length)warnings.push(`${recognized.rejectedCylinderFaceIds.length} zylindrische Fläche(n) wurden konservativ nicht als Bohrung klassifiziert.`);
  return{ok:true,toolpath,errors:[],warnings,holes};
}
