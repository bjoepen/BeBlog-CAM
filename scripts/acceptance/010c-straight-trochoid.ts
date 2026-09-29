import { buildStraightTrochoid } from '../../src/lib/trochoidalStraightMath';

const near = (a: number, b: number) => { if (Math.abs(a - b) > 1e-8) throw new Error(`${a} != ${b}`); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const guide = { kind: 'line' as const, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
const options = { radiusMm: 4, forwardStepMm: 2, freeSide: 'left' as const, loopDirection: 'ccw' as const };
const result = buildStraightTrochoid(guide, options);
expect(result.ok, result.errors.join('; '));
if (result.ok) {
  expect(result.loopCount === 51, '0..100 with step 2 has 51 stations');
  expect(result.segments.length === 152, 'two arcs per station and 50 free-side links');
  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];
    if (i) {
      const previous = result.segments[i - 1];
      near(previous.end.x, segment.start.x);
      near(previous.end.y, segment.start.y);
    }
    if (segment.kind === 'line') {
      near(segment.start.y, 8); near(segment.end.y, 8);
      near(segment.end.x - segment.start.x, 2);
    } else {
      near(segment.radius, 4); near(segment.center.y, 4);
      near(Math.hypot(segment.start.x - segment.center.x, segment.start.y - segment.center.y), 4);
      near(Math.hypot(segment.end.x - segment.center.x, segment.end.y - segment.center.y), 4);
      expect(segment.ccw, 'arc direction');
      expect(segment.center.y - segment.radius >= 0, 'entire circle remains on free side');
    }
  }
  near(result.segments[0].start.x, 0); near(result.segments[0].start.y, 8);
  near(result.segments[result.segments.length - 1].end.x, 100);
}

const right = buildStraightTrochoid(guide, { ...options, freeSide: 'right', loopDirection: 'cw' });
expect(right.ok, 'right side and clockwise must be supported');
if (right.ok) {
  expect(right.segments.every(s => s.kind !== 'arc' || (!s.ccw && s.center.y + s.radius <= 0)), 'right-side bound and clockwise arcs');
  expect(right.segments.every(s => s.kind !== 'line' || (s.start.y === -8 && s.end.y === -8)), 'right-side free links');
}
const diagonal = buildStraightTrochoid({ kind: 'line', start: { x: 10, y: -10 }, end: { x: 16, y: -2 } }, { ...options, forwardStepMm: 3 });
expect(diagonal.ok && diagonal.loopCount === 5, 'diagonal and short final interval');
if (diagonal.ok) near(diagonal.segments[diagonal.segments.length - 1].end.x, 16 - 2 * 4 * .8);

expect(!buildStraightTrochoid({ kind: 'line', start: guide.start, end: guide.start }, options).ok, 'zero length');
expect(!buildStraightTrochoid(guide, { ...options, radiusMm: 0 }).ok, 'zero radius');
expect(!buildStraightTrochoid(guide, { ...options, forwardStepMm: 9 }).ok, 'nonoverlapping loops');
expect(!buildStraightTrochoid(guide, { ...options, forwardStepMm: .00001 }).ok, 'loop cap');
expect(!buildStraightTrochoid(guide, { ...options, freeSide: 'invalid' as 'left' }).ok, 'invalid free side');
console.log('010-C straight trochoid geometry: PASS');
