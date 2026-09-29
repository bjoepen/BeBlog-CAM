import type { P2, SemanticSegment } from './contourMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';

export type ConstructiveSeedResult =
  | { ok: true; disk: AssumedClearedDisk; errors: [] }
  | { ok: false; disk: null; errors: string[] };

const EPS = 1e-7;
const CLEARANCE_MARGIN_MM = 1e-6;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 010-E5C: IF a full circular cutter-center sweep actually removed material
 * through this depth, its cutter disks cover the returned disk. No execution,
 * entry, or stock-history provenance is established by this function.
 */
export function constructAssumedDiskFromCircularSweep(
  priorPath: SemanticSegment[], priorCutterRadiusMm: number, priorClearedToDepthMm: number
): ConstructiveSeedResult {
  const fail = (message: string): ConstructiveSeedResult => ({ ok: false, disk: null, errors: [message] });
  if (!Number.isFinite(priorCutterRadiusMm) || priorCutterRadiusMm <= 0
    || !Number.isFinite(priorClearedToDepthMm) || priorClearedToDepthMm <= 0)
    return fail('Vorheriger Werkzeugradius und geräumte Tiefe müssen endlich und positiv sein.');
  if (!Array.isArray(priorPath) || priorPath.length !== 2
    || priorPath[0]?.kind !== 'arc' || priorPath[1]?.kind !== 'arc')
    return fail('Nur eine vollständige Zweibogen-Kreisbewegung ist als Quelle zulässig.');
  const [a, b] = priorPath;
  if (a.kind !== 'arc' || b.kind !== 'arc') return fail('Ungültige Kreisbögen.');
  if (!finite(a.center) || !finite(b.center) || !finite(a.start) || !finite(a.end)
    || !finite(b.start) || !finite(b.end) || typeof a.ccw !== 'boolean' || a.ccw !== b.ccw
    || !Number.isFinite(a.radius) || !Number.isFinite(b.radius) || a.radius <= EPS
    || distance(a.center, b.center) > EPS || Math.abs(a.radius - b.radius) > EPS
    || Math.abs(distance(a.start, a.center) - a.radius) > EPS
    || Math.abs(distance(a.end, a.center) - a.radius) > EPS
    || Math.abs(distance(b.start, b.center) - b.radius) > EPS
    || Math.abs(distance(b.end, b.center) - b.radius) > EPS
    || distance(a.end, b.start) > EPS || distance(b.end, a.start) > EPS
    || Math.abs(distance(a.start, a.end) - 2 * a.radius) > EPS)
    return fail('Vorherige Bewegung ist kein stetiger, konzentrischer Vollkreis.');
  if (a.radius >= priorCutterRadiusMm - CLEARANCE_MARGIN_MM)
    return fail('Kreisbahn lässt ein ungelöstes Innenloch oder keine belastbare Mitte.');
  // Leave a margin for the accepted 1e-7 mm arc/connection tolerances.
  const radiusMm = a.radius + priorCutterRadiusMm - CLEARANCE_MARGIN_MM;
  if (!Number.isFinite(radiusMm) || radiusMm <= 0)
    return fail('Abgeleitete Freiräumscheibe ist nicht endlich und positiv.');
  return { ok: true, disk: { center: { ...a.center }, radiusMm,
    clearedToDepthMm: priorClearedToDepthMm }, errors: [] };
}
