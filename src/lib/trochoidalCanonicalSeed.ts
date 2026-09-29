import type { CanonicalToolpath } from './canonicalToolpath';
import type { P2, SemanticSegment } from './contourMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { constructAssumedDiskFromCircularSweep } from './trochoidalConstructiveSeed';

export type CanonicalSeedResult =
  | { ok: true; disk: AssumedClearedDisk; sourceOperationId: string; runIndex: number; errors: [] }
  | { ok: false; disk: null; sourceOperationId: null; runIndex: null; errors: string[] };

const EPS = 1e-7;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 010-E5D: derive a conditional disk from exact, planned canonical cut geometry.
 * A canonical plan and source ID do not attest machine execution or safe entry.
 */
export function constructAssumedDiskFromCanonicalRun(
  prior: CanonicalToolpath, runIndex: number
): CanonicalSeedResult {
  const fail = (reason: string): CanonicalSeedResult => ({ ok: false, disk: null,
    sourceOperationId: null, runIndex: null, errors: [reason] });
  if (!prior || prior.version !== 1 || prior.operationKind !== 'contour' || prior.strategy !== 'contour'
    || typeof prior.sourceOperationId !== 'string' || !prior.sourceOperationId.trim()
    || !Number.isFinite(prior.tool?.diameterMm) || prior.tool.diameterMm <= 0
    || !Array.isArray(prior.runs) || !Number.isInteger(runIndex) || runIndex < 0 || runIndex >= prior.runs.length)
    return fail('Vorherige kanonische Konturbahn, Quelle, Werkzeug oder Schnittindex ist ungültig.');
  if (prior.motions?.length) return fail('Abweichende kanonische Maschinenbewegungen benötigen einen eigenen Nachweis.');
  const run = prior.runs[runIndex];
  if (!run || run.kind !== 'cut' || !Number.isFinite(run.z) || run.z >= 0
    || run.cutSegments3?.length || !Array.isArray(run.segments) || run.segments.length !== 2
    || !Array.isArray(run.points) || run.points.length !== 3 || run.segments.some(s => s?.kind !== 'arc'))
    return fail('Schnitt benötigt genau zwei native Kreisbögen bei endlicher negativer Tiefe.');
  const [a, b] = run.segments;
  if (a.kind !== 'arc' || b.kind !== 'arc'
    || !finite(a.start) || !finite(a.end) || !finite(a.center)
    || !finite(b.start) || !finite(b.end) || !finite(b.center)
    || run.points.some(p => !finite(p))
    || distance(run.points[0], a.start) > EPS
    || distance(run.points[1], a.end) > EPS
    || distance(run.points[1], b.start) > EPS
    || distance(run.points[2], b.end) > EPS)
    return fail('Kanonische Stützpunkte widersprechen den nativen Schnittbögen.');
  const semantic: SemanticSegment[] = [a, b].map(arc => ({ ...arc,
    radius: distance(arc.start, arc.center) }));
  const constructed = constructAssumedDiskFromCircularSweep(semantic, prior.tool.diameterMm / 2, -run.z);
  if (!constructed.ok) return fail(constructed.errors[0]);
  return { ok: true, disk: constructed.disk, sourceOperationId: prior.sourceOperationId,
    runIndex, errors: [] };
}
