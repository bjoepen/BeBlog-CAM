import type {
  StepManufacturingFeatureInventory,
  StepManufacturingInventoryEntry,
  StepInventorySourceReferences,
} from './stepManufacturingFeatureInventory';
import type { PartOrientation } from './types';

export type StepFeatureRecognitionStatus='recognized'|'candidate'|'unresolved'|'unsupported';
export type StepFeatureEvidenceConfidence=
  |'verified-conservative-recognition'
  |'verified-native-geometry'
  |'verified-reconstructed-geometry'
  |'incomplete-geometric-evidence';
export type StepManufacturingInterpretationKind=
  |'hole-making'
  |'facing-surface'
  |'pocket-floor'
  |'reference-surface'
  |'open-profile-machining'
  |'closed-profile-machining'
  |'bounded-region-boundary'
  |'pocket-region'
  |'planar-clearing-region';
export type StepRequiredEvidence=
  |'explicit-user-interpretation'
  |'explicit-feature-selection'
  |'material-removal-side'
  |'setup-accessibility'
  |'collision-clearance'
  |'operation-preflight'
  |'feature-termination'
  |'pocket-depth'
  |'entry-suitability';
export type StepFeatureUnknownKind=
  |'manufacturing-intent'
  |'explicit-user-selection'
  |'setup-accessibility'
  |'collision-clearance'
  |'material-removal-side'
  |'feature-termination'
  |'pocket-depth'
  |'entry-suitability'
  |'inside-outside-interpretation'
  |'geometry-support';

export type StepManufacturingInterpretation=Readonly<{
  kind:StepManufacturingInterpretationKind;
  status:'plausible-unproven';
  explanation:string;
  requiredEvidence:readonly StepRequiredEvidence[];
}>;
export type StepClassificationEvidence=Readonly<{
  kind:'verified-geometry'|'recognition-specific';
  statement:string;
  sourceReferences:StepInventorySourceReferences;
}>;
export type StepFeatureUnknown=Readonly<{kind:StepFeatureUnknownKind;statement:string}>;

type StepClassifiedFeatureBase=Readonly<{
  featureId:string;
  source:'step-brep-inventory';
  recognitionStatus:StepFeatureRecognitionStatus;
  confidence:StepFeatureEvidenceConfidence;
  sourceReferences:StepInventorySourceReferences;
  manufacturingInterpretations:readonly StepManufacturingInterpretation[];
  evidence:readonly StepClassificationEvidence[];
  unknowns:readonly StepFeatureUnknown[];
  limitations:readonly string[];
}>;
export type StepClassifiedHole=StepClassifiedFeatureBase&Readonly<{geometryKind:'hole';geometry:Extract<StepManufacturingInventoryEntry,{kind:'hole'}>['measurements']}>;
export type StepClassifiedCylinder=StepClassifiedFeatureBase&Readonly<{geometryKind:'unclassified-cylinder';geometry:Extract<StepManufacturingInventoryEntry,{kind:'unclassified-cylinder'}>['measurements']}>;
export type StepClassifiedPlanarFace=StepClassifiedFeatureBase&Readonly<{geometryKind:'planar-face';geometry:Extract<StepManufacturingInventoryEntry,{kind:'planar-face'}>['measurements']}>;
export type StepClassifiedContourWire=StepClassifiedFeatureBase&Readonly<{geometryKind:'contour-wire';geometry:Extract<StepManufacturingInventoryEntry,{kind:'contour-wire'}>['measurements']}>;
export type StepClassifiedPlanarRegion=StepClassifiedFeatureBase&Readonly<{geometryKind:'planar-region';geometry:Extract<StepManufacturingInventoryEntry,{kind:'planar-region'}>['measurements']}>;
export type StepClassifiedUnresolvedBoundary=StepClassifiedFeatureBase&Readonly<{geometryKind:'unresolved-boundary';geometry:Extract<StepManufacturingInventoryEntry,{kind:'unresolved-boundary'}>['measurements']}>;
export type StepClassifiedFeature=StepClassifiedHole|StepClassifiedCylinder|StepClassifiedPlanarFace|StepClassifiedContourWire|StepClassifiedPlanarRegion|StepClassifiedUnresolvedBoundary;
export type StepFeatureClassification=Readonly<{
  version:1;
  source:'step-manufacturing-feature-inventory';
  sourceInventoryVersion:1;
  orientation:PartOrientation;
  features:readonly StepClassifiedFeature[];
}>;
export type StepFeatureClassificationResult=
  |Readonly<{ok:true;classification:StepFeatureClassification;errors:readonly []}>
  |Readonly<{ok:false;classification:null;errors:readonly string[]}>;

const cloneRefs=(value:StepInventorySourceReferences):StepInventorySourceReferences=>({faceIds:[...value.faceIds],wireIds:[...value.wireIds],edgeIds:[...value.edgeIds]});
const finiteTuple=(value:unknown)=>Array.isArray(value)&&value.length===3&&value.every(item=>typeof item==='number'&&Number.isFinite(item));
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value);
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const referenceShape=(value:unknown)=>record(value)&&Array.isArray(value.faceIds)&&Array.isArray(value.wireIds)&&Array.isArray(value.edgeIds);
const validRefs=(value:unknown):value is StepInventorySourceReferences=>{
  if(!value||typeof value!=='object')return false;
  const refs=value as StepInventorySourceReferences;
  return(['faceIds','wireIds','edgeIds'] as const).every(key=>Array.isArray(refs[key])&&refs[key].every(item=>Number.isInteger(item)&&item>=0)&&refs[key].every((item,index)=>index===0||refs[key][index-1]<item));
};
const validTextList=(value:unknown,allowEmpty=false):value is readonly string[]=>Array.isArray(value)&&(allowEmpty||value.length>0)&&value.every(item=>typeof item==='string'&&item.length>0);
function validateEntry(entry:StepManufacturingInventoryEntry,index:number):string[]{
  const prefix=`STEP inventory entry ${index}`,errors:string[]=[];
  if(typeof entry.featureId!=='string'||!entry.featureId)errors.push(`${prefix}: stable featureId is missing.`);
  if(entry.source!=='step-brep')errors.push(`${prefix}: STEP/BRep source marker is invalid.`);
  if(!validRefs(entry.sourceReferences))errors.push(`${prefix}: native source references are invalid or not deterministically ordered.`);
  if(!validTextList(entry.evidence))errors.push(`${prefix}: verified geometric evidence is missing.`);
  if(!validTextList(entry.limitations,true))errors.push(`${prefix}: limitations are invalid.`);
  if(entry.kind==='hole'){
    const measurements=entry.measurements;
    if(entry.classification!=='recognized-geometric-feature')errors.push(`${prefix}: recognized-hole inventory classification is inconsistent.`);
    if(!validRefs(entry.recognitionEvidenceReferences))errors.push(`${prefix}: recognition-specific boundary references are invalid.`);
    else if(!entry.sourceReferences.faceIds.length||!entry.sourceReferences.wireIds.length||!entry.sourceReferences.edgeIds.length||!entry.recognitionEvidenceReferences.faceIds.length||!entry.recognitionEvidenceReferences.wireIds.length||!entry.recognitionEvidenceReferences.edgeIds.length||entry.recognitionEvidenceReferences.faceIds.some(id=>!entry.sourceReferences.faceIds.includes(id))||entry.recognitionEvidenceReferences.wireIds.some(id=>!entry.sourceReferences.wireIds.includes(id))||entry.recognitionEvidenceReferences.edgeIds.some(id=>!entry.sourceReferences.edgeIds.includes(id)))errors.push(`${prefix}: recognized-hole source topology is incomplete or inconsistent.`);
    if(!finite(measurements.diameterMm)||measurements.diameterMm<=0||!finite(measurements.depthMm)||measurements.depthMm<=0||!finiteTuple(measurements.axisOrigin)||!finiteTuple(measurements.axisDirection)||!finiteTuple(measurements.startCenter)||!finiteTuple(measurements.endCenter)||measurements.termination!=='unknown')errors.push(`${prefix}: recognized-hole measurements are incomplete or invalid.`);
  }else if(entry.kind==='unclassified-cylinder'){
    const measurements=entry.measurements;
    if(entry.classification!=='unclassified-geometry')errors.push(`${prefix}: cylinder inventory classification is inconsistent.`);
    if(!entry.sourceReferences.faceIds.length)errors.push(`${prefix}: cylindrical source topology is incomplete.`);
    if(!finite(measurements.radiusMm)||measurements.radiusMm<=0||!finiteTuple(measurements.axisOrigin)||!finiteTuple(measurements.axisDirection))errors.push(`${prefix}: cylindrical measurements are incomplete or invalid.`);
  }else if(entry.kind==='planar-face'){
    const measurements=entry.measurements;
    if(entry.classification!=='geometric-candidate-requiring-interpretation')errors.push(`${prefix}: planar-face inventory classification is inconsistent.`);
    if(!entry.sourceReferences.faceIds.length)errors.push(`${prefix}: planar-face source topology is incomplete.`);
    if(!finiteTuple(measurements.origin)||!finiteTuple(measurements.normal)||!Number.isInteger(measurements.wireCount)||measurements.wireCount<0||!Number.isInteger(measurements.closedWireCount)||measurements.closedWireCount<0||measurements.closedWireCount>measurements.wireCount)errors.push(`${prefix}: planar-face measurements are incomplete or invalid.`);
  }else if(entry.kind==='contour-wire'){
    const measurements=entry.measurements;
    if(entry.classification!=='candidate-requires-explicit-user-selection')errors.push(`${prefix}: contour inventory classification is inconsistent.`);
    if(!entry.sourceReferences.faceIds.length||!entry.sourceReferences.wireIds.length||!entry.sourceReferences.edgeIds.length)errors.push(`${prefix}: contour source topology is incomplete.`);
    if(!finite(measurements.zMm)||!finite(measurements.areaMm2)||measurements.areaMm2<0||(measurements.topology!=='open'&&measurements.topology!=='closed'))errors.push(`${prefix}: contour measurements are incomplete or invalid.`);
  }else if(entry.kind==='planar-region'){
    const measurements=entry.measurements;
    if(entry.classification!=='candidate-requires-explicit-user-selection')errors.push(`${prefix}: planar-region inventory classification is inconsistent.`);
    if(!entry.sourceReferences.faceIds.length||!entry.sourceReferences.wireIds.length||!entry.sourceReferences.edgeIds.length)errors.push(`${prefix}: planar-region source topology is incomplete.`);
    if(!finite(measurements.zMm)||!finite(measurements.areaMm2)||measurements.areaMm2<=0||!Number.isInteger(measurements.islandCount)||measurements.islandCount<0)errors.push(`${prefix}: planar-region measurements are incomplete or invalid.`);
  }else if(entry.kind==='unresolved-boundary'){
    const measurements=entry.measurements;
    if(entry.classification!=='unclassified-geometry')errors.push(`${prefix}: unresolved-boundary inventory classification is inconsistent.`);
    if(!entry.sourceReferences.faceIds.length||!entry.sourceReferences.wireIds.length||!entry.sourceReferences.edgeIds.length)errors.push(`${prefix}: unresolved-boundary source topology is incomplete.`);
    if(typeof measurements.nativeClosed!=='boolean'||!['unsupported-curve','reconstruction-failed','geometric-closure-mismatch','plane-inconsistent'].includes(measurements.resolution))errors.push(`${prefix}: unresolved-boundary reason is missing or invalid.`);
  }else errors.push(`${prefix}: unsupported inventory feature kind.`);
  return errors;
}

/** Stage A: validate containers before any nested value is dereferenced. */
function validateStructure(value:unknown):{inventory:StepManufacturingFeatureInventory|null;errors:string[]}{
  const errors:string[]=[];
  if(!record(value))return{inventory:null,errors:['STEP feature classification requires a non-null inventory object.']};
  if(value.version!==1)errors.push('STEP feature classification requires inventory version 1.');
  if(value.source!=='step-brep')errors.push('STEP feature classification requires a STEP/BRep inventory source.');
  if(!record(value.orientation))errors.push('STEP feature classification requires an orientation object.');
  else if(!finite(value.orientation.rotationXDeg)||!finite(value.orientation.rotationYDeg)||!finite(value.orientation.rotationZDeg))errors.push('STEP feature classification requires finite numeric orientation components.');
  if(!Array.isArray(value.entries))errors.push('STEP feature classification requires an entries array.');
  else value.entries.forEach((candidate,index)=>{
    const prefix=`STEP inventory entry ${index}`;
    if(!record(candidate)){errors.push(`${prefix}: entry must be a non-null object.`);return;}
    if(typeof candidate.featureId!=='string')errors.push(`${prefix}: featureId must be a string.`);
    if(typeof candidate.source!=='string')errors.push(`${prefix}: source must be a string.`);
    if(typeof candidate.kind!=='string')errors.push(`${prefix}: kind must be a string discriminant.`);
    if(typeof candidate.classification!=='string')errors.push(`${prefix}: classification must be a string discriminant.`);
    if(!referenceShape(candidate.sourceReferences))errors.push(`${prefix}: sourceReferences must contain faceIds, wireIds and edgeIds arrays.`);
    if(candidate.kind==='hole'&&!referenceShape(candidate.recognitionEvidenceReferences))errors.push(`${prefix}: recognized holes require recognitionEvidenceReferences arrays.`);
    if(!record(candidate.measurements))errors.push(`${prefix}: measurements must be a non-null object.`);
    if(!Array.isArray(candidate.evidence))errors.push(`${prefix}: evidence must be an array.`);
    if(!Array.isArray(candidate.limitations))errors.push(`${prefix}: limitations must be an array.`);
  });
  return{inventory:errors.length?null:value as unknown as StepManufacturingFeatureInventory,errors};
}
const interpretation=(kind:StepManufacturingInterpretationKind,explanation:string,requiredEvidence:StepRequiredEvidence[]):StepManufacturingInterpretation=>({kind,status:'plausible-unproven',explanation,requiredEvidence});
const unknown=(kind:StepFeatureUnknownKind,statement:string):StepFeatureUnknown=>({kind,statement});
const verifiedEvidence=(entry:StepManufacturingInventoryEntry):StepClassificationEvidence[]=>entry.evidence.map(statement=>({kind:'verified-geometry',statement,sourceReferences:cloneRefs(entry.sourceReferences)}));
const base=(entry:StepManufacturingInventoryEntry)=>({featureId:entry.featureId,source:'step-brep-inventory' as const,sourceReferences:cloneRefs(entry.sourceReferences),limitations:[...entry.limitations]});

function classifyEntry(entry:StepManufacturingInventoryEntry):StepClassifiedFeature{
  if(entry.kind==='hole')return{...base(entry),geometryKind:'hole',recognitionStatus:'recognized',confidence:'verified-conservative-recognition',geometry:{...entry.measurements,axisOrigin:[...entry.measurements.axisOrigin],axisDirection:[...entry.measurements.axisDirection],startCenter:[...entry.measurements.startCenter],endCenter:[...entry.measurements.endCenter]},manufacturingInterpretations:[interpretation('hole-making','The recognized cylindrical hole geometry may be interpreted for a user-selected hole-making process; no process is selected here.',['explicit-feature-selection','feature-termination','setup-accessibility','collision-clearance','operation-preflight'])],evidence:[...verifiedEvidence(entry),{kind:'recognition-specific',statement:'Exactly two matching closed circular boundaries support conservative hole recognition.',sourceReferences:cloneRefs(entry.recognitionEvidenceReferences)}],unknowns:[unknown('feature-termination','Blind versus through termination is unresolved.'),unknown('setup-accessibility','Tool approach and reach are not established by geometry recognition.'),unknown('collision-clearance','Tool and holder collision freedom are not established.'),unknown('explicit-user-selection','Production use requires explicit hole feature selection.')]};
  if(entry.kind==='unclassified-cylinder')return{...base(entry),geometryKind:'unclassified-cylinder',recognitionStatus:'unresolved',confidence:'verified-native-geometry',geometry:{...entry.measurements,axisOrigin:[...entry.measurements.axisOrigin],axisDirection:[...entry.measurements.axisDirection]},manufacturingInterpretations:[],evidence:verifiedEvidence(entry),unknowns:[unknown('geometry-support','The conservative recognized-hole boundary contract was not satisfied.'),unknown('manufacturing-intent','Cylindrical geometry alone does not establish hole intent.'),unknown('setup-accessibility','Tool approach and accessibility are unknown.')]};
  if(entry.kind==='planar-face')return{...base(entry),geometryKind:'planar-face',recognitionStatus:'recognized',confidence:'verified-native-geometry',geometry:{...entry.measurements,origin:[...entry.measurements.origin],normal:[...entry.measurements.normal]},manufacturingInterpretations:[interpretation('facing-surface','The planar face could be interpreted as a facing surface only with explicit user intent and material-side evidence.',['explicit-user-interpretation','material-removal-side','setup-accessibility','operation-preflight']),interpretation('pocket-floor','The planar face could be interpreted as a pocket floor only when complete enclosing boundaries, depth intent and accessibility are independently established.',['explicit-user-interpretation','pocket-depth','material-removal-side','setup-accessibility']),interpretation('reference-surface','The planar face could instead be a finished or reference surface requiring no removal.',['explicit-user-interpretation','material-removal-side'])],evidence:verifiedEvidence(entry),unknowns:[unknown('manufacturing-intent','Planarity does not establish facing, pocketing or preservation intent.'),unknown('material-removal-side','The material-removal side is unknown.'),unknown('setup-accessibility','Setup access is not established.')]};
  if(entry.kind==='contour-wire'){const closed=entry.measurements.topology==='closed';return{...base(entry),geometryKind:'contour-wire',recognitionStatus:'candidate',confidence:'verified-reconstructed-geometry',geometry:{...entry.measurements},manufacturingInterpretations:[interpretation(closed?'closed-profile-machining':'open-profile-machining',`The verified ${entry.measurements.topology} wire may be interpreted as a contour only after explicit user selection and intent.`,['explicit-user-interpretation','explicit-feature-selection','material-removal-side','setup-accessibility','operation-preflight']),...(closed?[interpretation('bounded-region-boundary','The closed wire may delimit a region, but boundary role and removal intent are not proven.',['explicit-user-interpretation','material-removal-side'])]:[])],evidence:verifiedEvidence(entry),unknowns:[unknown('manufacturing-intent','Wire topology does not establish contour machining intent.'),unknown('inside-outside-interpretation','Inside, outside or on-line interpretation is not selected.'),unknown('explicit-user-selection','Production contouring requires explicit wire selection.'),unknown('setup-accessibility','Tool access and collision clearance are unknown.')]};}
  if(entry.kind==='planar-region')return{...base(entry),geometryKind:'planar-region',recognitionStatus:'candidate',confidence:'verified-reconstructed-geometry',geometry:{...entry.measurements},manufacturingInterpretations:[interpretation('pocket-region','The complete bounded horizontal region may be interpreted as a pocket only with explicit depth and removal intent.',['explicit-user-interpretation','explicit-feature-selection','pocket-depth','entry-suitability','setup-accessibility','operation-preflight']),interpretation('planar-clearing-region','The same region may instead describe another explicitly selected planar clearing intent; no operation is chosen.',['explicit-user-interpretation','material-removal-side','setup-accessibility','operation-preflight'])],evidence:verifiedEvidence(entry),unknowns:[unknown('manufacturing-intent','A bounded planar region does not prove pocket intent.'),unknown('pocket-depth','Pocket depth and termination are not established by the region.'),unknown('entry-suitability','Entry suitability is unknown.'),unknown('explicit-user-selection','Production pocketing requires explicit face selection.'),unknown('setup-accessibility','Tool and holder accessibility are unknown.')]};
  const unsupported=entry.measurements.resolution==='unsupported-curve';
  return{...base(entry),geometryKind:'unresolved-boundary',recognitionStatus:unsupported?'unsupported':'unresolved',confidence:'incomplete-geometric-evidence',geometry:{...entry.measurements},manufacturingInterpretations:[],evidence:verifiedEvidence(entry),unknowns:[unknown('geometry-support',unsupported?'The native curve kind is unsupported by existing boundary reconstruction.':'The native boundary cannot be reconstructed as complete verified geometry.'),unknown('manufacturing-intent','Incomplete boundary geometry cannot support a manufacturing interpretation.'),unknown('setup-accessibility','Setup accessibility is not evaluated for unresolved geometry.')]};
}

/** Stateless 011-G2 classification over the immutable 011-G1 inventory. */
export function classifyStepManufacturingFeatures(value:unknown):StepFeatureClassificationResult{
  const structural=validateStructure(value);
  if(!structural.inventory)return{ok:false,classification:null,errors:structural.errors};
  const inventory=structural.inventory;
  const errors=inventory.entries.flatMap(validateEntry);
  if(!errors.length&&new Set(inventory.entries.map(entry=>entry.featureId)).size!==inventory.entries.length)errors.push('STEP inventory contains duplicate feature identities.');
  if(errors.length)return{ok:false,classification:null,errors};
  return{ok:true,errors:[],classification:{version:1,source:'step-manufacturing-feature-inventory',sourceInventoryVersion:1,orientation:{...inventory.orientation},features:inventory.entries.map(classifyEntry)}};
}
