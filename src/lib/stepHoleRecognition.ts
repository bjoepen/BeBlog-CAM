import type {
  Point3Tuple,
  StepCylindricalFaceSource,
  StepManufacturingEdgeSource,
  StepManufacturingFeatureSource,
  StepManufacturingWireSource,
} from './stepManufacturingFeatures';

export type StepHoleTermination = 'unknown';

export interface StepHoleFeature {
  featureId: string;
  source: 'step-brep';
  kind: 'hole';
  faceIds: number[];
  boundaryEdgeIds: number[];
  axisOrigin: Point3Tuple;
  axisDirection: Point3Tuple;
  startCenter: Point3Tuple;
  endCenter: Point3Tuple;
  diameterMm: number;
  depthMm: number;
  termination: StepHoleTermination;
  confidence: 'exact-cylinder-boundaries';
}

export interface StepHoleRecognitionResult {
  holes: StepHoleFeature[];
  rejectedCylinderFaceIds: number[];
}

const EPS_MM = 1e-5;
const AXIS_EPS = 1e-6;

const sub = (a: Point3Tuple, b: Point3Tuple): Point3Tuple => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: Point3Tuple, b: Point3Tuple): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const distance = (a: Point3Tuple, b: Point3Tuple): number => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const parallel = (a: Point3Tuple, b: Point3Tuple): boolean => Math.abs(Math.abs(dot(a,b))-1)<=AXIS_EPS;
const projectT = (point: Point3Tuple, origin: Point3Tuple, axis: Point3Tuple): number => dot(sub(point,origin),axis);

function faceEdges(source: StepManufacturingFeatureSource, faceId: number): StepManufacturingEdgeSource[] {
  const ids = new Set((source.wiresByFace.get(faceId) ?? []).flatMap((wire: StepManufacturingWireSource) => wire.edgeIds));
  return source.edges.filter(edge => ids.has(edge.edgeId));
}

function matchingCircularBoundaries(source: StepManufacturingFeatureSource, face: StepCylindricalFaceSource): StepManufacturingEdgeSource[] {
  return faceEdges(source, face.faceId).filter(edge =>
    edge.kind === 'circle' &&
    edge.closed &&
    edge.center !== undefined &&
    edge.axisDirection !== undefined &&
    edge.radiusMm !== undefined &&
    Math.abs(edge.radiusMm-face.radiusMm)<=EPS_MM &&
    parallel(edge.axisDirection, face.axisDirection)
  );
}

function recognizeCylinder(source: StepManufacturingFeatureSource, face: StepCylindricalFaceSource): StepHoleFeature | null {
  const circles = matchingCircularBoundaries(source, face);
  if(circles.length !== 2) return null;

  const ordered = [...circles].sort((a,b) =>
    projectT(a.center!, face.axisOrigin, face.axisDirection)-projectT(b.center!, face.axisOrigin, face.axisDirection)
  );
  const start = ordered[0].center!;
  const end = ordered[1].center!;
  const depthMm = distance(start,end);
  if (!(depthMm > EPS_MM)) return null;

  return {
    featureId: `step-hole-face-${face.faceId}`,
    source: 'step-brep',
    kind: 'hole',
    faceIds: [face.faceId],
    boundaryEdgeIds: ordered.map(edge => edge.edgeId),
    axisOrigin: face.axisOrigin,
    axisDirection: face.axisDirection,
    startCenter: start,
    endCenter: end,
    diameterMm: face.radiusMm*2,
    depthMm,
    termination: 'unknown',
    confidence: 'exact-cylinder-boundaries',
  };
}

/**
 * Build 004C: conservative recognition only.
 *
 * A cylindrical face becomes a hole candidate only when its exact BRep topology
 * contains exactly two closed circular boundary edges with the same radius and
 * a parallel axis. Blind/through classification is deliberately not guessed.
 */
export function recognizeStepHoles(source: StepManufacturingFeatureSource): StepHoleRecognitionResult {
  const holes: StepHoleFeature[] = [];
  const rejectedCylinderFaceIds: number[] = [];
  for (const face of source.cylindricalFaces) {
    const hole = recognizeCylinder(source, face);
    if (hole) holes.push(hole);
    else rejectedCylinderFaceIds.push(face.faceId);
  }
  return { holes, rejectedCylinderFaceIds };
}
