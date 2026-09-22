import type { ImportSummary, PartOrientation } from './types';
import { orientDirection3, orientTuple3 } from './partOrientation';

export type StepFaceOrientation='forward'|'reversed'|'internal'|'external'|'unknown';
export type StepManufacturingSurfaceKind='plane'|'cylinder'|'cone'|'sphere'|'torus'|'other';
export type StepManufacturingCurveKind='line'|'circle'|'ellipse'|'hyperbola'|'parabola'|'bezier'|'bspline'|'other';
export type Point3Tuple=[number,number,number];

export interface StepManufacturingFaceBase{faceId:number;kind:StepManufacturingSurfaceKind;orientation:StepFaceOrientation;}
export interface StepPlanarFaceSource extends StepManufacturingFaceBase{kind:'plane';origin:Point3Tuple;normal:Point3Tuple;}
export interface StepCylindricalFaceSource extends StepManufacturingFaceBase{kind:'cylinder';axisOrigin:Point3Tuple;axisDirection:Point3Tuple;radiusMm:number;}
export interface StepSphericalFaceSource extends StepManufacturingFaceBase{kind:'sphere';center:Point3Tuple;axisDirection:Point3Tuple;xDirection:Point3Tuple;yDirection:Point3Tuple;radiusMm:number;}
export interface StepOtherFaceSource extends StepManufacturingFaceBase{kind:'cone'|'torus'|'other';}
export type StepManufacturingFaceSource=StepPlanarFaceSource|StepCylindricalFaceSource|StepSphericalFaceSource|StepOtherFaceSource;

export interface StepManufacturingEdgeSource{
  edgeId:number;
  kind:StepManufacturingCurveKind;
  orientation:StepFaceOrientation;
  start:Point3Tuple;
  end:Point3Tuple;
  closed:boolean;
  degenerated:boolean;
  degeneratedPoint?:Point3Tuple;
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
  outer?:boolean;
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
const orthogonalish=(a:Point3Tuple,b:Point3Tuple)=>Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])<=1e-6;
function validateFace(face:StepManufacturingFaceSource,index:number):string[]{const p=`STEP BRep Face ${index}`,e:string[]=[];if(!Number.isInteger(face.faceId)||face.faceId<0)e.push(`${p}: ungültige faceId.`);if(face.kind==='plane'){if(!finite3(face.origin))e.push(`${p}: Ebenenursprung fehlt oder ist ungültig.`);if(!finite3(face.normal)||!unitish(face.normal))e.push(`${p}: Ebenennormale fehlt oder ist nicht normiert.`);}else if(face.kind==='cylinder'){if(!finite3(face.axisOrigin))e.push(`${p}: Zylinderachspunkt fehlt oder ist ungültig.`);if(!finite3(face.axisDirection)||!unitish(face.axisDirection))e.push(`${p}: Zylinderachse fehlt oder ist nicht normiert.`);if(!finitePositive(face.radiusMm))e.push(`${p}: Zylinderradius muss größer als 0 sein.`);}else if(face.kind==='sphere'){if(!finite3(face.center))e.push(`${p}: Kugelmittelpunkt fehlt oder ist ungültig.`);if(!finite3(face.axisDirection)||!unitish(face.axisDirection))e.push(`${p}: Kugelachse fehlt oder ist nicht normiert.`);if(!finite3(face.xDirection)||!unitish(face.xDirection))e.push(`${p}: Kugel-X-Achse fehlt oder ist nicht normiert.`);if(!finite3(face.yDirection)||!unitish(face.yDirection))e.push(`${p}: Kugel-Y-Achse fehlt oder ist nicht normiert.`);if(finite3(face.axisDirection)&&finite3(face.xDirection)&&!orthogonalish(face.axisDirection,face.xDirection))e.push(`${p}: Kugelachse und Kugel-X-Achse sind nicht orthogonal.`);if(finite3(face.axisDirection)&&finite3(face.yDirection)&&!orthogonalish(face.axisDirection,face.yDirection))e.push(`${p}: Kugelachse und Kugel-Y-Achse sind nicht orthogonal.`);if(finite3(face.xDirection)&&finite3(face.yDirection)&&!orthogonalish(face.xDirection,face.yDirection))e.push(`${p}: Kugel-X- und Kugel-Y-Achse sind nicht orthogonal.`);if(!finitePositive(face.radiusMm))e.push(`${p}: Kugelradius muss größer als 0 sein.`);}return e;}
function validateEdge(edge:StepManufacturingEdgeSource,index:number):string[]{const p=`STEP BRep Edge ${index}`,e:string[]=[];if(!Number.isInteger(edge.edgeId)||edge.edgeId<0)e.push(`${p}: ungültige edgeId.`);if(typeof edge.degenerated!=='boolean')e.push(`${p}: native Degenerated-Semantik fehlt.`);if(!finite3(edge.start)||!finite3(edge.end))e.push(`${p}: Start-/Endpunkt fehlt oder ist ungültig.`);if(edge.degenerated&&!finite3(edge.degeneratedPoint))e.push(`${p}: native Lage der degenerierten Kante fehlt oder ist ungültig.`);if(!edge.degenerated&&edge.degeneratedPoint!==undefined)e.push(`${p}: nicht degenerierte Kante darf keine Degenerated-Location tragen.`);if(edge.kind==='circle'){if(!finite3(edge.center))e.push(`${p}: Kreismittelpunkt fehlt.`);if(!finite3(edge.axisDirection)||!unitish(edge.axisDirection))e.push(`${p}: Kreisachse fehlt oder ist nicht normiert.`);if(!finitePositive(edge.radiusMm))e.push(`${p}: Kreisradius muss größer als 0 sein.`);}return e;}

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


/**
 * 008D-B: orientation-aware manufacturing view.
 *
 * Native STEP/BRep topology and identities remain the source of truth.
 * Only geometric coordinates and directions are rotated. No placement,
 * stock alignment, WCS translation or CAM classification happens here.
 */
export function orientStepManufacturingFeatureSource(
  source:StepManufacturingFeatureSource,
  orientation:PartOrientation,
):StepManufacturingFeatureSource{
  const faces=source.faces.map((face):StepManufacturingFaceSource=>{
    if(face.kind==='plane')return{
      ...face,
      origin:orientTuple3(face.origin,orientation),
      normal:orientDirection3(face.normal,orientation),
    };
    if(face.kind==='cylinder')return{
      ...face,
      axisOrigin:orientTuple3(face.axisOrigin,orientation),
      axisDirection:orientDirection3(face.axisDirection,orientation),
    };
    if(face.kind==='sphere')return{
      ...face,
      center:orientTuple3(face.center,orientation),
      axisDirection:orientDirection3(face.axisDirection,orientation),
      xDirection:orientDirection3(face.xDirection,orientation),
      yDirection:orientDirection3(face.yDirection,orientation),
    };
    return{...face};
  });
  const edges=source.edges.map((edge):StepManufacturingEdgeSource=>({
    ...edge,
    start:orientTuple3(edge.start,orientation),
    end:orientTuple3(edge.end,orientation),
    ...(edge.degeneratedPoint?{degeneratedPoint:orientTuple3(edge.degeneratedPoint,orientation)}:{}),
    ...(edge.center?{center:orientTuple3(edge.center,orientation)}:{}),
    ...(edge.axisDirection?{axisDirection:orientDirection3(edge.axisDirection,orientation)}:{}),
  }));
  const wires=source.wires.map(wire=>({...wire,edgeIds:[...wire.edgeIds]}));
  const wiresByFace=new Map<number,StepManufacturingWireSource[]>();
  for(const wire of wires)wiresByFace.set(wire.faceId,[...(wiresByFace.get(wire.faceId)??[]),wire]);
  return{
    ...source,
    faces,
    planarFaces:faces.filter((face):face is StepPlanarFaceSource=>face.kind==='plane'),
    cylindricalFaces:faces.filter((face):face is StepCylindricalFaceSource=>face.kind==='cylinder'),
    edges,
    wires,
    wiresByFace,
  };
}

export function buildOrientedStepManufacturingFeatureSource(
  summary:ImportSummary,
  orientation:PartOrientation,
):StepManufacturingFeatureSourceResult{
  const native=buildStepManufacturingFeatureSource(summary);
  if(!native.ok)return native;
  return{ok:true,errors:[],source:orientStepManufacturingFeatureSource(native.source,orientation)};
}
