import { generateJobGcode } from '../../src/lib/jobGcode';
import { postProcessEstlcam } from '../../src/lib/postprocessors';
import { buildStepContourTargets } from '../../src/lib/stepContourTargets';
import { buildStepPocketOperationState } from '../../src/lib/stepPocketOperation';
import { buildStepManufacturingFeatureSource } from '../../src/lib/stepManufacturingFeatures';
import { recognizeStepHoles } from '../../src/lib/stepHoleRecognition';
import {
  defaultContourOperation,
  defaultDrillOperation,
  defaultPartOrientation,
  defaultPartPlacement,
  defaultPocketOperation,
  defaultSurfaceFinishingOperation,
  defaultWcs,
  defaultZLevelRoughingOperation,
  type CamOperation,
  type ImportSummary,
  type StockDefinition,
} from '../../src/lib/types';

const stock: StockDefinition = { width: 60, height: 40, thickness: 10, offsetX: 0, offsetY: 0, offsetZ: 0 };
const placement = { ...defaultPartPlacement, horizontal: 'left' as const, vertical: 'front' as const };
const orientation = { ...defaultPartOrientation };
const wcs = { ...defaultWcs };

function requireNativeSummary(summary: ImportSummary) {
  const brep = summary.brep as any;
  if (summary.kind !== 'step') throw new Error('008A3 requires STEP summary');
  if (!brep?.nativeBrep) throw new Error('008A3 requires native OCCT BRep summary');
  if (!Array.isArray(brep.displayVertices) || brep.displayVertices.length === 0) throw new Error('008A3 native summary has no display triangulation');
  if (!Array.isArray(brep.displayFaceIds) || brep.displayFaceIds.length === 0) throw new Error('008A3 native summary has no face-id triangulation');
  return brep;
}

function discoverFixtures(summary: ImportSummary) {
  const brep = requireNativeSummary(summary);

  const contourTargets = buildStepContourTargets(summary).targets.filter((target) => target.topology === 'closed');
  if (!contourTargets.length) throw new Error('008A3 master exposes no closed STEP contour target');
  const contourTarget = [...contourTargets].sort((a, b) => b.zMm - a.zMm || b.points.length - a.points.length)[0];

  const pocketProbe = buildStepPocketOperationState({
    summary,
    stock,
    stockMode: 'manual',
    placement,
    orientation,
    wcs,
    operation: { ...defaultPocketOperation, stepFaceId: null, tool: { ...defaultPocketOperation.tool } },
  });
  const pocketCandidates = pocketProbe.candidates.filter((candidate) => candidate.zMm < 10 - 1e-6);
  if (!pocketCandidates.length) throw new Error('008A3 master exposes no sub-top planar pocket face');
  const pocketTarget = [...pocketCandidates].sort((a, b) => a.zMm - b.zMm || a.areaMm2 - b.areaMm2)[0];

  const featureSource = buildStepManufacturingFeatureSource(summary);
  if (!featureSource.ok) throw new Error(`008A3 manufacturing feature source failed: ${featureSource.errors.join(' | ')}`);
  const recognized = recognizeStepHoles(featureSource.source);
  if (recognized.holes.length < 2) throw new Error(`008A3 master expected two holes, recognized ${recognized.holes.length}`);
  const sixMmHoles = recognized.holes.filter((hole) => Math.abs(hole.diameterMm - 6) <= 0.01);
  if (sixMmHoles.length < 2) throw new Error(`008A3 master expected two Ø6 holes, recognized ${sixMmHoles.length}`);

  const manufacturingFaces = (brep.manufacturingFaces ?? []) as Array<{ faceId:number; kind:string; radiusMm?:number|null }>;
  const curved = manufacturingFaces.find((face) => face.kind !== 'plane' && face.kind !== 'cylinder')
    ?? manufacturingFaces.find((face) => face.kind === 'cylinder' && Math.abs((face.radiusMm ?? 0) - 3) > 0.01);
  if (!curved) throw new Error('008A3 master exposes no dedicated curved finishing face');

  return { contourTarget, pocketTarget, holes: sixMmHoles.slice(0, 2), curvedFaceId: curved.faceId };
}

function operationCases(summary: ImportSummary): Array<{ name:string; operation:CamOperation }> {
  const fixture = discoverFixtures(summary);
  return [
    {
      name: 'step-contour',
      operation: {
        ...defaultContourOperation,
        id: 'a3-step-contour',
        name: 'Kontur A3',
        stepWireId: fixture.contourTarget.wireId,
        contourId: null,
        contourIds: [],
        topology: 'closed',
        totalDepthMm: 2,
        stepDownMm: 1,
        tool: { ...defaultContourOperation.tool },
      },
    },
    {
      name: 'step-pocket',
      operation: {
        ...defaultPocketOperation,
        id: 'a3-step-pocket',
        name: 'Tasche A3',
        stepFaceId: fixture.pocketTarget.faceId,
        contourId: null,
        contourIds: [],
        tool: { ...defaultPocketOperation.tool },
      },
    },
    {
      name: 'step-drill',
      operation: {
        ...defaultDrillOperation,
        id: 'a3-step-drill',
        name: 'Bohren A3',
        curveIds: [],
        stepHoleFeatureIds: fixture.holes.map((hole) => hole.featureId),
        method: 'drill',
        totalDepthMm: 5,
        stepDownMm: 5,
        tool: { ...defaultDrillOperation.tool, id: 'a3-drill-6', name: 'Bohrer 6 mm', diameterMm: 6 },
      },
    },
    {
      name: 'z-level',
      operation: {
        ...defaultZLevelRoughingOperation,
        id: 'a3-z-level',
        name: 'Z-Level Schruppen A3',
        roughingMode: 'face-target',
        faceIds: [fixture.pocketTarget.faceId],
        stepDownMm: 1,
        tool: { ...defaultZLevelRoughingOperation.tool, diameterMm: 3, shaftDiameterMm: 3 },
      },
    },
    {
      name: 'surface-finishing',
      operation: {
        ...defaultSurfaceFinishingOperation,
        id: 'a3-surface-finishing',
        name: '3D Schlichten A3',
        faceIds: [fixture.curvedFaceId],
        stepoverPercent: 20,
        tool: { ...defaultSurfaceFinishingOperation.tool },
      },
    },
  ];
}

export function run008a3(summary: ImportSummary) {
  const cases = operationCases(summary);
  return cases.map(({ name, operation }) => {
    const job = generateJobGcode({ summary, stock, stockMode: 'manual', placement, orientation, wcs, operations: [operation] });
    const posted = job.ok ? postProcessEstlcam(job.code) : { ok: false, errors: ['raw job failed'], warnings: [], code: '' };
    return {
      name,
      safeZMm: operation.safeZMm,
      job: { ok: job.ok, errors: job.errors, warnings: job.warnings, code: job.code, lineCount: job.lineCount, operationCount: job.operationCount, toolChangeCount: job.toolChangeCount },
      estlcam: { ok: posted.ok, errors: posted.errors, warnings: posted.warnings, code: posted.code },
    };
  });
}
