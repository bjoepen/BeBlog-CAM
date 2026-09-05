import type { ImportSummary } from './types';

export type StepFaceOrientation='forward'|'reversed'|'internal'|'external'|'unknown';
export type StepManufacturingSurfaceKind='plane'|'cylinder'|'cone'|'sphere'|'torus'|'other';
export type StepManufacturingCurveKind='line'|'circle'|'ellipse'|'hyperbola'|'parabola'|'bezier'|'bspline'|'other';
export type Point3Tuple=[number,number,number];

export interface StepManufacturingFaceBase{faceId:number;kind:StepManufacturingSurfaceKind;orientation:StepFaceOrientation;}
export interface StepPlanarFaceSource extends StepManufacturingFaceBase{kind:'plane';origin:Point3Tuple;normal:Point3Tuple;}
export interface StepCylindricalFaceSource extends StepManufacturingFaceBase{kind:'cylinder';axisOrigin:Point3Tuple;axisDirection:Point3Tuple;radiusMm:number;}
export interface StepOtherFaceSource extends StepManufacturingFaceBase{kind:'cone'|'sphere'|'torus'|'other';}
export type StepManufacturingFaceSource=StepPlanarFaceSource|StepCylindricalFaceSource|StepOtherFaceSource;

export interface StepManufacturingEdgeSource{
  edgeId:number;
  kind:StepManufacturingCurveKind;
  orientation:StepFaceOrientation;
  start:Point3Tuple;
  end:Point3Tuple;
  closed:boolean;
  center?:Point3Tuple;
  axisDirection?:Point3Tuple;
  radiusMm?:number;
}
export interface StepManufacturingWireSource{
  wireId:number;
  faceId:number;
  orientation:StepFaceOrientation;
  closed:boolean;
  edgeIds:number[];
}

export interface StepManufacturingFeatureSource{
  version:2;
  source:'step-brep';
  exactBrep:true;
  faces:StepManufacturingFaceSource[];
  planarFaces:StepPlanarFaceSource[];
  cylindricalFaces:StepCylindricalFaceSource[];
  edges:StepManufacturingEdgeSource[];
  wires:StepManufacturingWireSource[];
  wiresByFace:Map<number,StepManufacturingWireSource[]>;
}
export type StepManufacturingFeatureSourceResult=|{ok:true;source:StepManufacturingFeatureSource;errors:[]}|{ok:false;source:null;errors:string[]};
type BrepWithManufacturingTopology=NonNullable<ImportSummary['brep']>&{manufacturingFaces?:StepManufacturingFaceSource[];manufacturingEdges?:StepManufacturingEdgeSource[];manufacturingWires?:StepManufacturingWireSource[];};

const finite3=(v:unknown):v is Point3Tuple=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
const finitePositive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const unitish=(v:Point3Tuple)=>Math.abs(Math.hypot(v[0],v[1],v[2])-1)<=1e-6;
function validateFace(face:StepManufacturingFaceSource,index:number):string[]{const p=`STEP BRep Face ${index}`,e:string[]=[];if(!Number.isInteger(face.faceId)||face.faceId<0)e.push(`${p}: ungültige faceId.`);if(face.kind==='plane'){if(!finite3(face.origin))e.push(`${p}: Ebenenursprung fehlt oder ist ungültig.`);if(!finite3(face.normal)||!unitish(face.normal))e.push(`${p}: Ebenennormale fehlt oder ist nicht normiert.`);}else if(face.kind==='cylinder'){if(!finite3(face.axisOrigin))e.push(`${p}: Zylinderachspunkt fehlt oder ist ungültig.`);if(!finite3(face.axisDirection)||!unitish(face.axisDirection))e.push(`${p}: Zylinderachse fehlt oder ist nicht normiert.`);if(!finitePositive(face.radiusMm))e.push(`${p}: Zylinderradius muss größer als 0 sein.`);}return e;}
function validateEdge(edge:StepManufacturingEdgeSource,index:number):string[]{const p=`STEP BRep Edge ${index}`,e:string[]=[];if(!Number.isInteger(edge.edgeId)||edge.edgeId<0)e.push(`${p}: ungültige edgeId.`);if(!finite3(edge.start)||!finite3(edge.end))e.push(`${p}: Start-/Endpunkt fehlt oder ist ungültig.`);if(edge.kind==='circle'){if(!finite3(edge.center))e.push(`${p}: Kreismittelpunkt fehlt.`);if(!finite3(edge.axisDirection)||!unitish(edge.axisDirection))e.push(`${p}: Kreisachse fehlt oder ist nicht normiert.`);if(!finitePositive(edge.radiusMm))e.push(`${p}: Kreisradius muss größer als 0 sein.`);}return e;}

/** 004B: exact BRep edge/wire topology. No contour/pocket/hole classification yet. */
export function buildStepManufacturingFeatureSource(summary:ImportSummary):StepManufacturingFeatureSourceResult{
  if(summary.kind!=='step')return{ok:false,source:null,errors:['STEP Manufacturing Features benötigen einen STEP/BRep-Import.']};
  const brep=summary.brep as BrepWithManufacturingTopology|undefined;
  if(!brep?.nativeBrep)return{ok:false,source:null,errors:['STEP Manufacturing Features benötigen natives BRep als Source of Truth.']};
  const faces=brep.manufacturingFaces,edges=brep.manufacturingEdges,wires=brep.manufacturingWires;
  if(!faces?.length)return{ok:false,source:null,errors:['Der native STEP-Import liefert keine Manufacturing-Face-Semantik.']};
  if(!edges?.length)return{ok:false,source:null,errors:['Der native STEP-Import liefert keine Manufacturing-Edge-Semantik.']};
  if(!wires?.length)return{ok:false,source:null,errors:['Der native STEP-Import liefert keine Manufacturing-Wire-Topologie.']};
  const errors=[...faces.flatMap(validateFace),...edges.flatMap(validateEdge)];
  if(new Set(faces.map(x=>x.faceId)).size!==faces.length)errors.push('STEP Manufacturing Faces enthalten doppelte faceIds.');
  if(new Set(edges.map(x=>x.edgeId)).size!==edges.length)errors.push('STEP Manufacturing Edges enthalten doppelte edgeIds.');
  if(new Set(wires.map(x=>x.wireId)).size!==wires.length)errors.push('STEP Manufacturing Wires enthalten doppelte wireIds.');
  if(faces.length!==brep.faces)errors.push(`STEP Manufacturing Face Count ${faces.length} stimmt nicht mit BRep Face Count ${brep.faces} überein.`);
  if(edges.length!==brep.edges)errors.push(`STEP Manufacturing Edge Count ${edges.length} stimmt nicht mit BRep Edge Count ${brep.edges} überein.`);
  for(const wire of wires){if(wire.faceId<0||wire.faceId>=faces.length)errors.push(`STEP Wire ${wire.wireId}: ungültige faceId.`);if(!wire.edgeIds.length)errors.push(`STEP Wire ${wire.wireId}: enthält keine Kanten.`);if(wire.edgeIds.some(id=>id<0||id>=edges.length))errors.push(`STEP Wire ${wire.wireId}: enthält ungültige edgeId.`);}
  if(errors.length)return{ok:false,source:null,errors};
  const wiresByFace=new Map<number,StepManufacturingWireSource[]>();for(const wire of wires)wiresByFace.set(wire.faceId,[...(wiresByFace.get(wire.faceId)??[]),wire]);
  return{ok:true,errors:[],source:{version:2,source:'step-brep',exactBrep:true,faces:[...faces],planarFaces:faces.filter((f):f is StepPlanarFaceSource=>f.kind==='plane'),cylindricalFaces:faces.filter((f):f is StepCylindricalFaceSource=>f.kind==='cylinder'),edges:[...edges],wires:[...wires],wiresByFace}};
}
