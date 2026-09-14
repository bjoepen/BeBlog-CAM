import { materializeSafeMotionChain } from '../../src/lib/safeMotionChain';
import type { CanonicalToolpath } from '../../src/lib/canonicalToolpath';

const safeZMm = 5;
const cutZ = -0.5;
const leadStart = { x: 60.79, y: 1.988 };
const contourStart = { x: 60.79, y: 4.988 };
const contourEnd = { x: 60.79, y: 4.988 };

const toolpath: CanonicalToolpath = {
  version: 1,
  operationKind: 'contour',
  strategy: 'contour',
  tool: { diameterMm: 3 },
  stepoverPercent: 0,
  runs: [{
    kind: 'cut',
    z: cutZ,
    points: [contourStart, { x: 70, y: 4.988 }, contourEnd],
    entrySegments: [
      { kind: 'line3', start: { ...leadStart, z: safeZMm }, end: { ...leadStart, z: cutZ }, feedMmMin: 200 },
      { kind: 'line3', start: { ...leadStart, z: cutZ }, end: { ...contourStart, z: cutZ }, feedMmMin: 600 },
    ],
    retractAfter: true,
  }],
};

const result = materializeSafeMotionChain({ toolpath, safeZMm });
console.log(JSON.stringify({
  ok: result.ok,
  errors: result.errors,
  warnings: result.warnings,
  startSafePoint: result.startSafePoint,
  motions: result.toolpath?.motions ?? [],
  leadStart,
  contourStart,
  safeZMm,
}));
