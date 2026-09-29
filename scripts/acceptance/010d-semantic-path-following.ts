import { buildSemanticTrochoid, measureSemanticGuide, stationAtLength } from '../../src/lib/trochoidalSemanticMath';
import { buildStraightTrochoid } from '../../src/lib/trochoidalStraightMath';
import type { SemanticSegment } from '../../src/lib/contourMath';

const near = (a: number, b: number) => { if (Math.abs(a - b) > 1e-7) throw new Error(`${a} != ${b}`); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const options = { radiusMm: 4, forwardStepMm: 2, freeSide: 'left' as const, loopDirection: 'ccw' as const };
const straight: SemanticSegment = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
const baseline = buildStraightTrochoid(straight as Extract<SemanticSegment, {kind:'line'}>, options);
const matching = buildSemanticTrochoid([straight], options);
expect(baseline.ok && matching.ok, 'straight reference must pass both kernels');
if (baseline.ok && matching.ok) {
  expect(matching.loopCount === baseline.loopCount, 'straight station count parity');
  expect(JSON.stringify(matching.segments) === JSON.stringify(baseline.segments), '010-C native segment parity');
}

const mixed: SemanticSegment[] = [
  { kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
  { kind: 'arc', start: { x: 10, y: 0 }, end: { x: 20, y: 10 }, center: { x: 10, y: 10 }, radius: 10, ccw: true },
  { kind: 'line', start: { x: 20, y: 10 }, end: { x: 20, y: 20 } }
];
const measured = measureSemanticGuide(mixed);
expect(measured.ok, `smooth LINE/ARC/LINE: ${measured.errors.join('; ')}`);
if (measured.ok) {
  near(measured.metric.totalLengthMm, 20 + Math.PI * 5);
  const start = stationAtLength(measured.metric, 0);
  const join = stationAtLength(measured.metric, 10);
  const middle = stationAtLength(measured.metric, 10 + Math.PI * 2.5);
  const end = stationAtLength(measured.metric, measured.metric.totalLengthMm);
  expect(!!start && !!join && !!middle && !!end, 'station bounds');
  if (start && join && middle && end) {
    near(start.point.x, 0); near(start.tangent.x, 1);
    near(join.point.x, 10); near(join.tangent.x, 1);
    near(middle.point.x, 10 + Math.sqrt(50)); near(middle.point.y, 10 - Math.sqrt(50));
    near(middle.tangent.x, Math.SQRT1_2); near(middle.tangent.y, Math.SQRT1_2);
    near(end.point.x, 20); near(end.point.y, 20); near(end.tangent.y, 1);
  }
  expect(stationAtLength(measured.metric, -1) === null && stationAtLength(measured.metric, measured.metric.totalLengthMm + 1) === null, 'out of range');
}
const followed = buildSemanticTrochoid(mixed, options);
expect(followed.ok && !followed.closed, 'mixed reference path');
if (followed.ok) {
  for (let i = 1; i < followed.segments.length; i++) {
    near(followed.segments[i - 1].end.x, followed.segments[i].start.x);
    near(followed.segments[i - 1].end.y, followed.segments[i].start.y);
  }
  expect(followed.segments.filter(s => s.kind === 'arc').length === followed.loopCount * 2, 'native loop arcs');
  near(followed.segments[followed.segments.length - 1].end.x, 12);
  near(followed.segments[followed.segments.length - 1].end.y, 20);
}

const circle: SemanticSegment[] = [
  { kind: 'arc', start: { x: 10, y: 0 }, end: { x: -10, y: 0 }, center: { x: 0, y: 0 }, radius: 10, ccw: true },
  { kind: 'arc', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, center: { x: 0, y: 0 }, radius: 10, ccw: true }
];
const closed = buildSemanticTrochoid(circle, { ...options, forwardStepMm: 5 });
expect(closed.ok && closed.closed && closed.loopCount === 13, 'smooth closed LINE/ARC guide');
if (closed.ok) {
  near(closed.guideLengthMm, 20 * Math.PI);
  near(closed.segments[closed.segments.length - 1].end.x, closed.segments[0].start.x);
  near(closed.segments[closed.segments.length - 1].end.y, closed.segments[0].start.y);
  expect(closed.segments.length === 39, 'closed path has one link per loop and no duplicate terminal loop');
}

const corner: SemanticSegment[] = [straight, { kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: 10 } }];
expect(!buildSemanticTrochoid(corner, options).ok, 'sharp corner must wait for 010-E');
expect(!measureSemanticGuide([straight, { kind: 'line', start: { x: 101, y: 0 }, end: { x: 110, y: 0 } }]).ok, 'gap');
expect(!measureSemanticGuide([{ kind: 'arc', start: { x: 10, y: 0 }, end: { x: -10, y: 0 }, center: { x: 0, y: 0 }, radius: 9, ccw: true }]).ok, 'invalid arc radius');
expect(!measureSemanticGuide([{ kind: 'other' } as unknown as SemanticSegment]).ok, 'unknown runtime segment');
const clockwise: SemanticSegment = { kind: 'arc', start: { x: 0, y: 10 }, end: { x: 10, y: 0 }, center: { x: 0, y: 0 }, radius: 10, ccw: false };
const clockwiseMetric = measureSemanticGuide([clockwise]);
expect(clockwiseMetric.ok, 'clockwise quarter circle');
if (clockwiseMetric.ok) {
  near(clockwiseMetric.metric.totalLengthMm, 5 * Math.PI);
  const halfway = stationAtLength(clockwiseMetric.metric, 2.5 * Math.PI);
  expect(!!halfway, 'clockwise midpoint');
  if (halfway) { near(halfway.point.x, Math.sqrt(50)); near(halfway.point.y, Math.sqrt(50)); }
}
expect(!buildSemanticTrochoid(circle, { ...options, radiusMm: 40, forwardStepMm: 80 }).ok, 'single closed station must fail');
expect(!buildSemanticTrochoid(mixed, { ...options, forwardStepMm: 9 }).ok, 'nonoverlapping loops');
console.log('010-D semantic LINE/ARC following: PASS');
