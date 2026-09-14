import assert from 'node:assert/strict';

export { assert };

export const point = (x, y) => ({ x, y });
export const line = (x1, y1, x2, y2) => ({ kind: 'line', start: point(x1, y1), end: point(x2, y2) });
export const circle = (x, y, radius) => ({ kind: 'circle', center: point(x, y), radius });

export function rectangleGeometry({ x = 0, y = 0, width = 40, height = 20, layer = 'CUT' } = {}) {
  return {
    curves: [
      line(x, y, x + width, y),
      line(x + width, y, x + width, y + height),
      line(x + width, y + height, x, y + height),
      line(x, y + height, x, y),
    ],
    curveLayers: [layer, layer, layer, layer],
    layerNames: [layer],
    bounds: { min: point(x, y), max: point(x + width, y + height) },
  };
}

export function drillGeometry({ holes = [[10, 10], [30, 10]], radius = 1.5, layer = 'DRILL' } = {}) {
  return {
    curves: holes.map(([x, y]) => circle(x, y, radius)),
    curveLayers: holes.map(() => layer),
    layerNames: [layer],
  };
}

export function dxfSummary({ fileName = 'synthetic-acceptance.dxf', geometry = rectangleGeometry() } = {}) {
  return {
    kind: 'dxf',
    fileName,
    backend: '008A synthetic fixture',
    status: 'ready',
    entities: { curves: geometry.curves.length },
    planarGeometry: geometry,
    note: 'Generated in code; no external DXF fixture required.',
  };
}

const wordPattern = /([A-Z])\s*([-+]?\d+(?:\.\d+)?)/gi;

export function parseNc(source) {
  return source
    .split(/\r?\n/)
    .map((raw, index) => {
      const text = raw.trim();
      if (!text) return null;
      const comment = text.startsWith('(') && text.endsWith(')');
      const words = {};
      if (!comment) {
        for (const match of text.matchAll(wordPattern)) {
          const key = match[1].toUpperCase();
          const value = Number(match[2]);
          if (!Number.isNaN(value)) words[key] = value;
        }
      }
      return { line: index + 1, raw, text, comment, words };
    })
    .filter(Boolean);
}

export function ncMotionLines(source) {
  return parseNc(source).filter((entry) => [0, 1, 2, 3].includes(entry.words.G));
}

export function ncStats(source) {
  const lines = parseNc(source);
  const motions = lines.filter((entry) => [0, 1, 2, 3].includes(entry.words.G));
  const gCounts = new Map();
  const mCounts = new Map();
  for (const entry of lines) {
    if (Number.isFinite(entry.words.G)) gCounts.set(entry.words.G, (gCounts.get(entry.words.G) ?? 0) + 1);
    if (Number.isFinite(entry.words.M)) mCounts.set(entry.words.M, (mCounts.get(entry.words.M) ?? 0) + 1);
  }
  const zValues = motions.map((entry) => entry.words.Z).filter(Number.isFinite);
  return {
    lineCount: lines.length,
    motionCount: motions.length,
    gCounts,
    mCounts,
    minZ: zValues.length ? Math.min(...zValues) : null,
    maxZ: zValues.length ? Math.max(...zValues) : null,
  };
}

export function assertNcCommandsAllowed(source, { g = [0, 1, 2, 3], m = [0, 1, 3, 5, 6, 8, 9, 10, 11] } = {}) {
  for (const entry of parseNc(source)) {
    if (Number.isFinite(entry.words.G)) assert.ok(g.includes(entry.words.G), `NC line ${entry.line}: unsupported G${entry.words.G}`);
    if (Number.isFinite(entry.words.M)) assert.ok(m.includes(entry.words.M), `NC line ${entry.line}: unsupported M${entry.words.M}`);
  }
}

export function assertNoXyRapidBelow(source, safeZ) {
  let z = null;
  for (const entry of parseNc(source)) {
    const nextZ = Number.isFinite(entry.words.Z) ? entry.words.Z : z;
    const xy = Number.isFinite(entry.words.X) || Number.isFinite(entry.words.Y);
    if (entry.words.G === 0 && xy) {
      assert.ok(nextZ !== null && nextZ >= safeZ, `NC line ${entry.line}: XY rapid at Z ${nextZ ?? 'unknown'} below safe Z ${safeZ}`);
    }
    z = nextZ;
  }
}

export function assertToolChangeIsStopped(source) {
  const lines = parseNc(source).filter((entry) => !entry.comment);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].words.M !== 6) continue;
    const priorM = lines.slice(0, i).reverse().find((entry) => Number.isFinite(entry.words.M));
    assert.equal(priorM?.words.M, 5, `NC line ${lines[i].line}: M6 must be preceded by spindle stop M5`);
  }
}

export function assertArcRadiusConsistency(source, tolerance = 0.01) {
  let x = 0;
  let y = 0;
  for (const entry of parseNc(source)) {
    const nextX = Number.isFinite(entry.words.X) ? entry.words.X : x;
    const nextY = Number.isFinite(entry.words.Y) ? entry.words.Y : y;
    if ((entry.words.G === 2 || entry.words.G === 3) && Number.isFinite(entry.words.I) && Number.isFinite(entry.words.J)) {
      const cx = x + entry.words.I;
      const cy = y + entry.words.J;
      const startRadius = Math.hypot(x - cx, y - cy);
      const endRadius = Math.hypot(nextX - cx, nextY - cy);
      assert.ok(Math.abs(startRadius - endRadius) <= tolerance, `NC line ${entry.line}: arc radius mismatch ${startRadius} vs ${endRadius}`);
    }
    x = nextX;
    y = nextY;
  }
}

export function acceptanceCase(name, run) {
  try {
    run();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return false;
  }
}
