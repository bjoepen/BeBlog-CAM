import type { CurvedFaceDegeneracyCandidate } from './curvedFaceTarget';
import type { DegeneracyClassificationResult, DegeneracyProof } from './threeDDegeneracyClassification';
import { orientPoint3 } from './partOrientation';
import { buildOrientedStepManufacturingFeatureSource } from './stepManufacturingFeatures';
import type { ImportSummary, PartOrientation, PartPlacement, StockDefinition } from './types';
import type { P3 } from './stepView';

const DIAGNOSTIC_TRIANGLE_INDEX=321;
const POLE_TOLERANCE_MM=1e-6;

function bounds(points:P3[]){
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y),zs=points.map(point=>point.z);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}

function distance3(a:P3,b:P3){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}

type Gate={gate:string;status:'PASS'|'FAIL';observed:unknown};

export function emitCandidate321SingleRunDiagnostic(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  part:P3[];
  candidate:CurvedFaceDegeneracyCandidate;
  placementOffset:{x:number;y:number;z:number}|null;
  boundaryGeometryAvailable:boolean;
  boundaryProof:DegeneracyProof|null;
  finalProofs:DegeneracyProof[];
  classification:DegeneracyClassificationResult;
}){
  if(args.candidate.triangleIndex!==DIAGNOSTIC_TRIANGLE_INDEX)return;

  const native=args.summary.brep?.diagnostics?.candidate321;
  const nativeTriangle=native?.nativeTriangle??null;
  const source=buildOrientedStepManufacturingFeatureSource(args.summary,args.orientation);
  const face=source.ok?source.source.faces.find(item=>item.faceId===args.candidate.faceId):undefined;
  const sphere=face?.kind==='sphere'?face:null;
  const rawValues=args.summary.brep?.displayVertices??[],orientedRaw:P3[]=[];
  for(let i=0;i+2<rawValues.length;i+=3)orientedRaw.push(orientPoint3({x:rawValues[i],y:rawValues[i+1],z:rawValues[i+2]},args.orientation));
  const rawBounds=orientedRaw.length?bounds(orientedRaw):null;
  const partBounds=args.part.length?bounds(args.part):null;
  const partWidth=rawBounds?rawBounds.maxX-rawBounds.minX:null;
  const partHeight=rawBounds?rawBounds.maxY-rawBounds.minY:null;
  const tx=rawBounds&&partWidth!==null?(args.placement.horizontal==='left'?0:args.placement.horizontal==='right'?args.stock.width-partWidth:(args.stock.width-partWidth)/2):null;
  const ty=rawBounds&&partHeight!==null?(args.placement.vertical==='front'?0:args.placement.vertical==='back'?args.stock.height-partHeight:(args.stock.height-partHeight)/2):null;
  const explicitPlacementTransform=rawBounds&&tx!==null&&ty!==null?{
    dx:tx-rawBounds.minX+args.placement.offsetX,
    dy:ty-rawBounds.minY+args.placement.offsetY,
    dz:-rawBounds.minZ+args.placement.offsetZ,
  }:null;

  const center=sphere&&args.placementOffset?{
    x:sphere.center[0]+args.placementOffset.x,
    y:sphere.center[1]+args.placementOffset.y,
    z:sphere.center[2]+args.placementOffset.z,
  }:null;
  const axis=sphere?{x:sphere.axisDirection[0],y:sphere.axisDirection[1],z:sphere.axisDirection[2]}:null;
  const axisLength=axis?Math.hypot(axis.x,axis.y,axis.z):null;
  const poles=center&&axis&&sphere?{
    plus:{x:center.x+axis.x*sphere.radiusMm,y:center.y+axis.y*sphere.radiusMm,z:center.z+axis.z*sphere.radiusMm},
    minus:{x:center.x-axis.x*sphere.radiusMm,y:center.y-axis.y*sphere.radiusMm,z:center.z-axis.z*sphere.radiusMm},
  }:null;
  const points=[args.candidate.triangle.a,args.candidate.triangle.b,args.candidate.triangle.c];
  const labels=['A','B','C'] as const;
  const distances=poles?Object.fromEntries(labels.flatMap((label,index)=>[
    [`${label}->Pole+`,distance3(points[index],poles.plus)],
    [`${label}->Pole-`,distance3(points[index],poles.minus)],
  ])):null;
  const polePlusHits=poles?points.filter(point=>distance3(point,poles.plus)<=POLE_TOLERANCE_MM).length:0;
  const poleMinusHits=poles?points.filter(point=>distance3(point,poles.minus)<=POLE_TOLERANCE_MM).length:0;
  const matchingPoleCount=(polePlusHits>=2?1:0)+(poleMinusHits>=2?1:0);
  const uvPoleDistances=nativeTriangle?.uvNodes?.map(([u,v],index)=>({vertex:labels[index],u,v,toPolePlus:Math.abs(v-Math.PI/2),toPoleMinus:Math.abs(v+Math.PI/2)}))??null;
  const xyArea2=(points[1].x-points[0].x)*(points[2].y-points[0].y)-(points[1].y-points[0].y)*(points[2].x-points[0].x);

  const gates:Gate[]=[
    {gate:'manufacturing-source-valid',status:source.ok?'PASS':'FAIL',observed:source.ok?'step-brep':source.errors},
    {gate:'placement-offset-available',status:args.placementOffset?'PASS':'FAIL',observed:args.placementOffset},
    {gate:'candidate-face-found',status:face?'PASS':'FAIL',observed:face?.faceId??null},
    {gate:'candidate-face-is-sphere',status:sphere?'PASS':'FAIL',observed:face?.kind??null},
    {gate:'sphere-radius-finite-positive',status:sphere&&Number.isFinite(sphere.radiusMm)&&sphere.radiusMm>0?'PASS':'FAIL',observed:sphere?.radiusMm??null},
    {gate:'sphere-axis-unit-within-1e-6',status:axisLength!==null&&Number.isFinite(axisLength)&&Math.abs(axisLength-1)<=POLE_TOLERANCE_MM?'PASS':'FAIL',observed:axisLength},
    {gate:'exactly-one-pole-has-at-least-two-3d-vertex-hits-within-1e-6mm',status:matchingPoleCount===1?'PASS':'FAIL',observed:{polePlusHits,poleMinusHits,matchingPoleCount}},
  ];

  const diagnosticBlock={
    diagnosticOnly:true,
    native:{occtVersion:native?.occtVersion??null,meshingParameters:native?.meshingParameters??null,triangle:nativeTriangle},
    candidate:{displayTriangleIndex:args.candidate.triangleIndex,faceId:args.candidate.faceId,placedPoints:{A:points[0],B:points[1],C:points[2]},xyArea2},
    face:{nativeGetType:nativeTriangle?.face.getType??null,nativeOrientation:nativeTriangle?.face.orientation??null,nativeUvBounds:nativeTriangle?.face.uvBounds??null,nativeTopLocTransform:nativeTriangle?.face.topLocTransform??null,nativeSphere:nativeTriangle?.face.sphere??null,orientedManufacturingFace:face??null},
    applicationTransform:{partOrientation:args.orientation,stock:args.stock,partPlacement:args.placement,explicitPlacementTransform,placementOffset:args.placementOffset,orientedRawBounds:rawBounds,placedBounds:partBounds},
    analyticSphere:{placedCenter:center,axisDirection:axis,radiusMm:sphere?.radiusMm??null,polePlus:poles?.plus??null,poleMinus:poles?.minus??null},
    measurements:{distances3dMm:distances,uvDistancesToSpherePoleParameterLines:uvPoleDistances,threeDimensionalHitCounts:{toleranceMm:POLE_TOLERANCE_MM,polePlusHits,poleMinusHits}},
    proofGates:gates,
    firstFailingSphereProofGate:gates.find(gate=>gate.status==='FAIL')??null,
    boundary:{geometryAvailable:args.boundaryGeometryAvailable,proof:args.boundaryProof,gate:args.boundaryProof?'PASS':'FAIL'},
    finalProofList:args.finalProofs,
    finalClassification:args.classification,
  };
  console.info(`[008H-A24-A7-DIAGNOSTIC][CANDIDATE-321][BEGIN]\n${JSON.stringify(diagnosticBlock,null,2)}\n[008H-A24-A7-DIAGNOSTIC][CANDIDATE-321][END]`);
}
