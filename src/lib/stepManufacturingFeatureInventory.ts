import { buildStepContourTargets } from './stepContourTargets';
import { recognizeStepHoles } from './stepHoleRecognition';
import { buildOrientedStepManufacturingFeatureSource, type Point3Tuple } from './stepManufacturingFeatures';
import { buildStepPocketCandidates } from './stepPocketOperation';
import type { ImportSummary, PartOrientation } from './types';

export type StepInventoryClassification=
  |'recognized-geometric-feature'
  |'geometric-candidate-requiring-interpretation'
  |'unclassified-geometry'
  |'candidate-requires-explicit-user-selection';
export type StepInventoryFeatureKind='hole'|'unclassified-cylinder'|'planar-face'|'contour-wire'|'planar-region';
export type StepInventorySourceReferences=Readonly<{
  faceIds:readonly number[];
  wireIds:readonly number[];
  edgeIds:readonly number[];
}>;
type StepInventoryBase=Readonly<{
  featureId:string;
  source:'step-brep';
  kind:StepInventoryFeatureKind;
  classification:StepInventoryClassification;
  sourceReferences:StepInventorySourceReferences;
  evidence:readonly string[];
  limitations:readonly string[];
}>;
export type StepHoleInventoryEntry=StepInventoryBase&Readonly<{
  kind:'hole';
  measurements:Readonly<{axisOrigin:Point3Tuple;axisDirection:Point3Tuple;startCenter:Point3Tuple;endCenter:Point3Tuple;diameterMm:number;depthMm:number;termination:'unknown'}>;
}>;
export type StepCylinderInventoryEntry=StepInventoryBase&Readonly<{
  kind:'unclassified-cylinder';
  measurements:Readonly<{axisOrigin:Point3Tuple;axisDirection:Point3Tuple;radiusMm:number}>;
}>;
export type StepPlanarFaceInventoryEntry=StepInventoryBase&Readonly<{
  kind:'planar-face';
  measurements:Readonly<{origin:Point3Tuple;normal:Point3Tuple;wireCount:number;closedWireCount:number}>;
}>;
export type StepContourWireInventoryEntry=StepInventoryBase&Readonly<{
  kind:'contour-wire';
  measurements:Readonly<{zMm:number;topology:'closed'|'open';areaMm2:number}>;
}>;
export type StepPlanarRegionInventoryEntry=StepInventoryBase&Readonly<{
  kind:'planar-region';
  measurements:Readonly<{zMm:number;areaMm2:number;islandCount:number}>;
}>;
export type StepManufacturingInventoryEntry=StepHoleInventoryEntry|StepCylinderInventoryEntry|StepPlanarFaceInventoryEntry|StepContourWireInventoryEntry|StepPlanarRegionInventoryEntry;
export type StepManufacturingFeatureInventory=Readonly<{version:1;source:'step-brep';orientation:PartOrientation;entries:readonly StepManufacturingInventoryEntry[]}>;
export type StepManufacturingFeatureInventoryResult=
  |Readonly<{ok:true;inventory:StepManufacturingFeatureInventory;errors:readonly []}>
  |Readonly<{ok:false;inventory:null;errors:readonly string[]}>;

const tuples=(value:Point3Tuple):Point3Tuple=>[...value];
const refs=(faceIds:number[]=[],wireIds:number[]=[],edgeIds:number[]=[]):StepInventorySourceReferences=>({faceIds:[...faceIds].sort((a,b)=>a-b),wireIds:[...wireIds].sort((a,b)=>a-b),edgeIds:[...edgeIds].sort((a,b)=>a-b)});
const rank:Record<StepInventoryFeatureKind,number>={hole:0,'unclassified-cylinder':1,'planar-face':2,'contour-wire':3,'planar-region':4};
const firstId=(entry:StepManufacturingInventoryEntry)=>entry.sourceReferences.faceIds[0]??entry.sourceReferences.wireIds[0]??Number.MAX_SAFE_INTEGER;

/**
 * Read-only geometric inventory. Entries are evidence, never machining approval:
 * existing operation selection and preflight contracts remain authoritative.
 */
export function buildStepManufacturingFeatureInventory(summary:ImportSummary,orientation:PartOrientation):StepManufacturingFeatureInventoryResult{
  const sourceResult=buildOrientedStepManufacturingFeatureSource(summary,orientation);
  if(!sourceResult.ok)return{ok:false,inventory:null,errors:[...sourceResult.errors]};
  const source=sourceResult.source,entries:StepManufacturingInventoryEntry[]=[];
  const holes=recognizeStepHoles(source);
  for(const hole of holes.holes)entries.push({
    featureId:hole.featureId,source:'step-brep',kind:'hole',classification:'recognized-geometric-feature',
    sourceReferences:refs(hole.faceIds,[],hole.boundaryEdgeIds),
    measurements:{axisOrigin:tuples(hole.axisOrigin),axisDirection:tuples(hole.axisDirection),startCenter:tuples(hole.startCenter),endCenter:tuples(hole.endCenter),diameterMm:hole.diameterMm,depthMm:hole.depthMm,termination:hole.termination},
    evidence:['Exact cylindrical BRep face with exactly two matching closed circular boundaries.'],
    limitations:['Blind/through termination is unresolved.','Recognition does not prove accessibility, collision freedom or machining approval.'],
  });
  for(const faceId of holes.rejectedCylinderFaceIds){const face=source.cylindricalFaces.find(candidate=>candidate.faceId===faceId);if(!face)continue;entries.push({
    featureId:`step-cylinder-face-${faceId}`,source:'step-brep',kind:'unclassified-cylinder',classification:'unclassified-geometry',sourceReferences:refs([faceId]),
    measurements:{axisOrigin:tuples(face.axisOrigin),axisDirection:tuples(face.axisDirection),radiusMm:face.radiusMm},
    evidence:['Native BRep surface is cylindrical.'],limitations:['Conservative hole recognition requirements were not met.','No manufacturing intent is inferred.'],
  });}
  for(const face of source.planarFaces){const wires=source.wiresByFace.get(face.faceId)??[];entries.push({
    featureId:`step-planar-face-${face.faceId}`,source:'step-brep',kind:'planar-face',classification:'geometric-candidate-requiring-interpretation',
    sourceReferences:refs([face.faceId],wires.map(wire=>wire.wireId),wires.flatMap(wire=>wire.edgeIds)),
    measurements:{origin:tuples(face.origin),normal:tuples(face.normal),wireCount:wires.length,closedWireCount:wires.filter(wire=>wire.closed).length},
    evidence:['Native BRep surface is planar.'],limitations:['Planarity does not establish pocket, facing or other machining intent.','Accessibility and material-side interpretation are unresolved.'],
  });}
  const contours=buildStepContourTargets(summary,orientation);
  if(contours.errors.length)return{ok:false,inventory:null,errors:[...contours.errors]};
  for(const target of contours.targets)entries.push({
    featureId:target.targetKey,source:'step-brep',kind:'contour-wire',classification:'candidate-requires-explicit-user-selection',sourceReferences:refs([target.faceId],[target.wireId],target.edgeIds),
    measurements:{zMm:target.zMm,topology:target.topology,areaMm2:target.areaMm2},
    evidence:[`Connected ${target.topology} native BRep wire on a horizontal planar face.`],
    limitations:['Contour candidacy does not prove machinability or select an inside/outside interpretation.','Production contouring still requires explicit stepWireId selection and normal preflight.'],
  });
  for(const region of buildStepPocketCandidates(summary,orientation))entries.push({
    featureId:`step-planar-region-face-${region.faceId}`,source:'step-brep',kind:'planar-region',classification:'candidate-requires-explicit-user-selection',
    sourceReferences:refs([region.faceId],[region.outerWireId,...region.islandWireIds],region.edgeIds),measurements:{zMm:region.zMm,areaMm2:region.areaMm2,islandCount:region.islands.length},
    evidence:['Horizontal planar BRep face has a closed outer boundary.',...(region.islands.length?['Contained closed wires are preserved as islands.']:[])],
    limitations:['A bounded planar region is not proof of pocket intent.','Production pocketing still requires explicit stepFaceId selection and normal preflight.'],
  });
  entries.sort((a,b)=>rank[a.kind]-rank[b.kind]||firstId(a)-firstId(b)||(a.featureId<b.featureId?-1:a.featureId>b.featureId?1:0));
  return{ok:true,errors:[],inventory:{version:1,source:'step-brep',orientation:{...orientation},entries}};
}
