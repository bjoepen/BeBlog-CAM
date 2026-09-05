import type { ImportSummary } from './types';

export type StepFaceOrientation='forward'|'reversed'|'internal'|'external'|'unknown';
export type StepManufacturingSurfaceKind='plane'|'cylinder'|'cone'|'sphere'|'torus'|'other';
export type Point3Tuple=[number,number,number];

export interface StepManufacturingFaceBase{
  faceId:number;
  kind:StepManufacturingSurfaceKind;
  orientation:StepFaceOrientation;
}

export interface StepPlanarFaceSource extends StepManufacturingFaceBase{
  kind:'plane';
  origin:Point3Tuple;
  normal:Point3Tuple;
}

export interface StepCylindricalFaceSource extends StepManufacturingFaceBase{
  kind:'cylinder';
  axisOrigin:Point3Tuple;
  axisDirection:Point3Tuple;
  radiusMm:number;
}

export interface StepOtherFaceSource extends StepManufacturingFaceBase{
  kind:'cone'|'sphere'|'torus'|'other';
}

export type StepManufacturingFaceSource=StepPlanarFaceSource|StepCylindricalFaceSource|StepOtherFaceSource;

export interface StepManufacturingFeatureSource{
  version:1;
  source:'step-brep';
  exactBrep:true;
  faces:StepManufacturingFaceSource[];
  planarFaces:StepPlanarFaceSource[];
  cylindricalFaces:StepCylindricalFaceSource[];
}

export type StepManufacturingFeatureSourceResult=
  |{ok:true;source:StepManufacturingFeatureSource;errors:[]}
  |{ok:false;source:null;errors:string[]};

type BrepWithManufacturingFaces=NonNullable<ImportSummary['brep']>&{
  manufacturingFaces?:StepManufacturingFaceSource[];
};

const finite3=(value:unknown):value is Point3Tuple=>Array.isArray(value)&&value.length===3&&value.every(item=>typeof item==='number'&&Number.isFinite(item));
const finitePositive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const unitish=(value:Point3Tuple)=>Math.abs(Math.hypot(value[0],value[1],value[2])-1)<=1e-6;

function validateFace(face:StepManufacturingFaceSource,index:number):string[]{
  const prefix=`STEP BRep Face ${index}`;
  const errors:string[]=[];
  if(!Number.isInteger(face.faceId)||face.faceId<0)errors.push(`${prefix}: ungültige faceId.`);
  if(face.kind==='plane'){
    if(!finite3(face.origin))errors.push(`${prefix}: Ebenenursprung fehlt oder ist ungültig.`);
    if(!finite3(face.normal)||!unitish(face.normal))errors.push(`${prefix}: Ebenennormale fehlt oder ist nicht normiert.`);
  }else if(face.kind==='cylinder'){
    if(!finite3(face.axisOrigin))errors.push(`${prefix}: Zylinderachspunkt fehlt oder ist ungültig.`);
    if(!finite3(face.axisDirection)||!unitish(face.axisDirection))errors.push(`${prefix}: Zylinderachse fehlt oder ist nicht normiert.`);
    if(!finitePositive(face.radiusMm))errors.push(`${prefix}: Zylinderradius muss größer als 0 sein.`);
  }
  return errors;
}

/**
 * 004A boundary: expose exact STEP/BRep face semantics to later manufacturing
 * feature recognizers. This function deliberately does NOT classify holes,
 * pockets, contours or machining accessibility. Those are higher-level builds.
 */
export function buildStepManufacturingFeatureSource(summary:ImportSummary):StepManufacturingFeatureSourceResult{
  if(summary.kind!=='step')return{ok:false,source:null,errors:['STEP Manufacturing Features benötigen einen STEP/BRep-Import.']};
  const brep=summary.brep as BrepWithManufacturingFaces|undefined;
  if(!brep?.nativeBrep)return{ok:false,source:null,errors:['STEP Manufacturing Features benötigen natives BRep als Source of Truth.']};
  const faces=brep.manufacturingFaces;
  if(!faces?.length)return{ok:false,source:null,errors:['Der native STEP-Import liefert noch keine Manufacturing-Face-Semantik.']};

  const errors=faces.flatMap((face,index)=>validateFace(face,index));
  const ids=faces.map(face=>face.faceId);
  if(new Set(ids).size!==ids.length)errors.push('STEP Manufacturing Faces enthalten doppelte faceIds.');
  if(faces.length!==brep.faces)errors.push(`STEP Manufacturing Face Count ${faces.length} stimmt nicht mit BRep Face Count ${brep.faces} überein.`);
  if(errors.length)return{ok:false,source:null,errors};

  return{
    ok:true,
    errors:[],
    source:{
      version:1,
      source:'step-brep',
      exactBrep:true,
      faces:[...faces],
      planarFaces:faces.filter((face):face is StepPlanarFaceSource=>face.kind==='plane'),
      cylindricalFaces:faces.filter((face):face is StepCylindricalFaceSource=>face.kind==='cylinder'),
    },
  };
}
