import type { CurvedFaceTarget } from './curvedFaceTarget';
import { buildCurvedFaceTarget, provenAnalyticBoundaryForCandidate, selectedCurvedFaceDegeneracyCandidates, selectedCurvedFaceTargetNeedsBoundaryProof } from './curvedFaceTarget';
import { orientPoint3 } from './partOrientation';
import { buildOrientedStepManufacturingFeatureSource } from './stepManufacturingFeatures';
import { classifyProvenDegeneracy } from './threeDDegeneracyClassification';
import type { DegeneracyProof } from './threeDDegeneracyClassification';
import { buildThreeDDegeneracyAcceptanceSnapshot, emitThreeDDegeneracyAcceptanceSnapshot } from './threeDDegeneracyAcceptance';
import type { P3 } from './stepView';
import type {
  ImportSummary,
  PartOrientation,
  PartPlacement,
  StockDefinition,
} from './types';

export type ThreeDSurfaceTargetState={
  ok:boolean;
  target:CurvedFaceTarget|null;
  errors:string[];
  warnings:string[];
  triangleCount:number;
  boundaryDiagnostics:CurvedFaceTarget['boundaryDiagnostics'];
};

function bounds(points:P3[]){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
  return{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
}


function placementOffset(summary:ImportSummary,orientation:PartOrientation,part:P3[]):{x:number;y:number;z:number}|null{
  const rawValues=summary.brep?.displayVertices??[],orientedRaw:P3[]=[];
  for(let i=0;i+2<rawValues.length;i+=3)orientedRaw.push(orientPoint3({x:rawValues[i],y:rawValues[i+1],z:rawValues[i+2]},orientation));
  if(!orientedRaw.length||!part.length)return null;
  const rawBounds=bounds(orientedRaw),placedBounds=bounds(part);
  return{x:placedBounds.minX-rawBounds.minX,y:placedBounds.minY-rawBounds.minY,z:placedBounds.minZ-rawBounds.minZ};
}

function distance3(a:P3,b:P3){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}

function placedSphereSingularityProofs(
  summary:ImportSummary,
  orientation:PartOrientation,
  part:P3[],
  candidates:ReturnType<typeof selectedCurvedFaceDegeneracyCandidates>,
):Map<number,DegeneracyProof[]>{
  const result=new Map<number,DegeneracyProof[]>();
  const source=buildOrientedStepManufacturingFeatureSource(summary,orientation);
  const offset=placementOffset(summary,orientation,part);
  if(!source.ok||!offset)return result;
  const place=(tuple:[number,number,number]):P3=>({x:tuple[0]+offset.x,y:tuple[1]+offset.y,z:tuple[2]+offset.z});
  const tolerance=1e-6;

  for(const candidate of candidates){
    const face=source.source.faces.find(item=>item.faceId===candidate.faceId);
    if(!face||face.kind!=='sphere')continue;
    const center=place(face.center);
    const axis={x:face.axisDirection[0],y:face.axisDirection[1],z:face.axisDirection[2]};
    const poles=[
      {x:center.x+axis.x*face.radiusMm,y:center.y+axis.y*face.radiusMm,z:center.z+axis.z*face.radiusMm},
      {x:center.x-axis.x*face.radiusMm,y:center.y-axis.y*face.radiusMm,z:center.z-axis.z*face.radiusMm},
    ];
    const faceWires=source.source.wiresByFace.get(candidate.faceId)??[];
    const edgeIds=new Set(faceWires.flatMap(wire=>wire.edgeIds));
    for(const edgeId of edgeIds){
      const edge=source.source.edges[edgeId];
      if(!edge?.degenerated||!edge.degeneratedPoint)continue;
      const point=place(edge.degeneratedPoint);
      if(!poles.some(pole=>distance3(point,pole)<=tolerance))continue;
      const points=[candidate.triangle.a,candidate.triangle.b,candidate.triangle.c];
      if(points.filter(vertex=>distance3(vertex,point)<=tolerance).length<2)continue;
      const proof:DegeneracyProof={
        kind:'surface-singularity',
        candidate:{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex},
        candidatePoints:points.map(vertex=>({...vertex})),
        edgeId,
        degeneratedPoint:{...point},
      };
      result.set(candidate.triangleIndex,[...(result.get(candidate.triangleIndex)??[]),proof]);
    }
  }
  return result;
}


type PlacedOuterBoundaryResult=
  |{ok:true;geometry:import('./curvedFaceTarget').CurvedFaceBoundaryGeometry[]}
  |{ok:false;error:string};

function placedOuterBoundaryGeometry(summary:ImportSummary,orientation:PartOrientation,faceIds:number[],part:P3[]):PlacedOuterBoundaryResult{
  const source=buildOrientedStepManufacturingFeatureSource(summary,orientation);
  if(!source.ok)return{ok:false,error:`BRep Boundary Truth nicht verfügbar: ${source.errors.join(' ')}`};
  const selected=new Set(faceIds);
  const outerWires=source.source.wires.filter(wire=>selected.has(wire.faceId)&&wire.outer===true);
  if(!outerWires.length)return{ok:false,error:'BRep Boundary Truth nicht verfügbar: Für die ausgewählte Fläche wurde kein nativer OuterWire geliefert.'};

  const offset=placementOffset(summary,orientation,part);
  if(!offset)return{ok:false,error:'BRep Boundary Truth konnte nicht in den platzierten Modellraum überführt werden.'};
  const place=(tuple:[number,number,number]):P3=>({x:tuple[0]+offset.x,y:tuple[1]+offset.y,z:tuple[2]+offset.z});

  const boundaries:import('./curvedFaceTarget').CurvedFaceBoundaryGeometry[]=[];
  for(const wire of outerWires)for(const edgeId of wire.edgeIds){
    const edge=source.source.edges[edgeId];
    if(!edge)return{ok:false,error:`BRep Boundary Truth unvollständig: Edge ${edgeId} des OuterWire ${wire.wireId} fehlt.`};
    if(edge.kind==='line'){boundaries.push({kind:'line',wireId:wire.wireId,edgeId,start:place(edge.start),end:place(edge.end)});continue;}
    if(edge.kind==='circle'&&edge.center&&edge.radiusMm&&edge.axisDirection){
      boundaries.push({kind:'circle',wireId:wire.wireId,edgeId,center:place(edge.center),axisDirection:{x:edge.axisDirection[0],y:edge.axisDirection[1],z:edge.axisDirection[2]},radiusMm:edge.radiusMm});
      continue;
    }
    return{ok:false,error:`BRep Boundary Truth unterstützt OuterWire ${wire.wireId} / Edge ${edgeId} (${edge.kind}) noch nicht analytisch.`};
  }
  return boundaries.length?{ok:true,geometry:boundaries}:{ok:false,error:'BRep Boundary Truth enthält keine beweisbare analytische Außenkante.'};
}

export function buildPlacedPartTriangles(summary:ImportSummary,stock:StockDefinition,placement:PartPlacement,orientation:PartOrientation):P3[]|null{
  if(summary.kind!=='step')return null;
  const values=summary.brep?.displayVertices??[],raw:P3[]=[];
  for(let i=0;i+2<values.length;i+=3)raw.push(orientPoint3({x:values[i],y:values[i+1],z:values[i+2]},orientation));
  if(!raw.length)return null;

  const b=bounds(raw),partWidth=b.maxX-b.minX,partHeight=b.maxY-b.minY;
  const tx=placement.horizontal==='left'?0:placement.horizontal==='right'?stock.width-partWidth:(stock.width-partWidth)/2;
  const ty=placement.vertical==='front'?0:placement.vertical==='back'?stock.height-partHeight:(stock.height-partHeight)/2;
  const dx=tx-b.minX+placement.offsetX,dy=ty-b.minY+placement.offsetY;
  return raw.map(point=>({x:point.x+dx,y:point.y+dy,z:point.z-b.minZ+placement.offsetZ}));
}

export function buildThreeDSurfaceTargetState(args:{
  summary:ImportSummary;
  stock:StockDefinition;
  placement:PartPlacement;
  orientation:PartOrientation;
  faceIds:number[];
  operationLabel:string;
}):ThreeDSurfaceTargetState{
  const {summary,stock,placement,orientation,faceIds,operationLabel}=args;
  const errors:string[]=[],warnings:string[]=[];

  if(summary.kind!=='step')errors.push(`${operationLabel} benötigt ein STEP/BRep-Modell.`);
  if(!faceIds.length)errors.push(`Keine STEP/BRep-Fläche für ${operationLabel} gewählt.`);
  if(errors.length)return{ok:false,target:null,errors,warnings,triangleCount:0,boundaryDiagnostics:[]};

  const part=buildPlacedPartTriangles(summary,stock,placement,orientation);
  const displayFaceIds=summary.brep?.displayFaceIds??[];
  if(!part||displayFaceIds.length!==Math.floor(part.length/3)){
    return{ok:false,target:null,errors:['STEP/BRep-Triangulation oder Face-ID-Zuordnung konnte nicht rekonstruiert werden.'],warnings,triangleCount:0,boundaryDiagnostics:[]};
  }

  const needsBoundaryProof=selectedCurvedFaceTargetNeedsBoundaryProof(part,displayFaceIds,faceIds);
  let boundaryGeometry:import('./curvedFaceTarget').CurvedFaceBoundaryGeometry[]|undefined;
  const degeneracyClassifications=new Map<number,ReturnType<typeof classifyProvenDegeneracy>>();
  let degeneracyCandidates:ReturnType<typeof selectedCurvedFaceDegeneracyCandidates>=[];
  if(needsBoundaryProof){
    const candidates=selectedCurvedFaceDegeneracyCandidates(part,displayFaceIds,faceIds);
    degeneracyCandidates=candidates;
    const singularityProofs=placedSphereSingularityProofs(summary,orientation,part,candidates);
    const outerBoundary=placedOuterBoundaryGeometry(summary,orientation,faceIds,part);
    if(outerBoundary.ok)boundaryGeometry=outerBoundary.geometry;

    for(const candidate of candidates){
      const proofs:DegeneracyProof[]=[...(singularityProofs.get(candidate.triangleIndex)??[])];
      if(boundaryGeometry){
        const boundary=provenAnalyticBoundaryForCandidate(candidate,boundaryGeometry);
        if(boundary&&boundary.wireId!==undefined&&boundary.edgeId!==undefined)proofs.push({
          kind:'boundary',
          candidate:{faceId:candidate.faceId,triangleIndex:candidate.triangleIndex},
          candidatePoints:[candidate.triangle.a,candidate.triangle.b,candidate.triangle.c].map(point=>({...point})),
          wireId:boundary.wireId,
          edgeId:boundary.edgeId,
        });
      }
      degeneracyClassifications.set(candidate.triangleIndex,classifyProvenDegeneracy(proofs));
    }
  }
  emitThreeDDegeneracyAcceptanceSnapshot({operationLabel,snapshot:buildThreeDDegeneracyAcceptanceSnapshot(degeneracyCandidates,degeneracyClassifications)});
  const target=buildCurvedFaceTarget(part,displayFaceIds,faceIds,undefined,boundaryGeometry,degeneracyClassifications);
  warnings.push(...target.warnings);
  errors.push(...target.errors);
  return{
    ok:target.valid&&errors.length===0,
    target:target.valid&&errors.length===0?target:null,
    errors:[...new Set(errors)],
    warnings:[...new Set(warnings)],
    triangleCount:target.triangles.length,
    boundaryDiagnostics:target.boundaryDiagnostics,
  };
}
