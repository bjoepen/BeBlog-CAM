import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';

const near = (actual: number, expected: number) => {
  if (Math.abs(actual - expected) > 1e-6) throw new Error(`expected ${expected}, got ${actual}`);
};
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const rectangle: Curve2[] = [{ kind: 'polyline', closed: true, points: [
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }
] }];
const operation = { ...defaultTrochoidalContourContract, contourId: 0 };
const outer = buildTrochoidalContourGuide(rectangle, operation);
expect(outer.ok, `outer rectangle: ${outer.errors.join('; ')}`);
if (outer.ok) {
  near(outer.guide.signedOffsetMm, 3.2);
  expect(outer.guide.segments.length === 8, 'outside rectangle must use four tangent lines and four corner arcs');
  const firstLine=outer.guide.segments[0],firstArc=outer.guide.segments[1],secondLine=outer.guide.segments[2];
  expect(firstLine.kind==='line'&&firstArc.kind==='arc'&&secondLine.kind==='line','outside rectangle must alternate LINE/ARC');
  if(firstLine.kind==='line'&&firstArc.kind==='arc'&&secondLine.kind==='line'){
    near(firstLine.start.x,0);near(firstLine.start.y,-3.2);
    near(firstLine.end.x,100);near(firstLine.end.y,-3.2);
    near(firstArc.center.x,100);near(firstArc.center.y,0);near(firstArc.radius,3.2);
    near(firstArc.start.x,firstLine.end.x);near(firstArc.start.y,firstLine.end.y);
    near(firstArc.end.x,secondLine.start.x);near(firstArc.end.y,secondLine.start.y);
    const lineTangent={x:firstLine.end.x-firstLine.start.x,y:firstLine.end.y-firstLine.start.y};
    const radial={x:firstArc.start.x-firstArc.center.x,y:firstArc.start.y-firstArc.center.y};
    near(lineTangent.x*radial.x+lineTangent.y*radial.y,0);
  }
  expect(outer.guide.validation.ok&&outer.guide.validation.sideOk,'outer tangent offset validation');
  near(outer.guide.validation.measuredMinMm,3.2);near(outer.guide.validation.measuredMaxMm,3.2);
}
const inner = buildTrochoidalContourGuide(rectangle, { ...operation, side: 'inside' });
expect(inner.ok, `inner rectangle: ${inner.errors.join('; ')}`);
if (inner.ok) {
  near(inner.guide.signedOffsetMm, -3.2);
  near(inner.guide.segments[0].start.x, 3.2);
  near(inner.guide.segments[0].start.y, 3.2);
}
const reverse: Curve2[] = [{ kind: 'polyline', closed: true, points: [...(rectangle[0] as Extract<Curve2, {kind:'polyline'}>).points].reverse() }];
const reversed = buildTrochoidalContourGuide(reverse, operation);
expect(reversed.ok && reversed.guide.validation.sideOk, 'clockwise winding should preserve outside semantics');

const mixed: Curve2[] = [{ kind: 'polyline', closed: true, points: [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }
], bulges: [0, 0, 1, 0] }];
const arc = buildTrochoidalContourGuide(mixed, operation);
expect(arc.ok, `mixed LINE/ARC contour: ${arc.errors.join('; ')}`);
if (arc.ok) {
  const sourceArc = arc.guide.source.find(s => s.kind === 'arc');
  const guideArc = arc.guide.segments.find(s => s.kind === 'arc');
  expect(!!sourceArc && !!guideArc, 'native ARC must survive offset');
  if (sourceArc?.kind === 'arc' && guideArc?.kind === 'arc') near(guideArc.radius - sourceArc.radius, 3.2);
}

const open: Curve2[] = [{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }];
expect(!buildTrochoidalContourGuide(open, operation).ok, 'open line must fail');
expect(!buildTrochoidalContourGuide(rectangle, { ...operation, contourId: 1 }).ok, 'unknown contour must fail');
expect(!buildTrochoidalContourGuide(rectangle, { ...operation, tool: { ...operation.tool, diameterMm: 60 }, side: 'inside' }).ok, 'collapsed inside offset must fail');
expect(buildTrochoidalContourGuide([{ kind: 'circle', center: { x: 0, y: 0 }, radius: 10 }], operation).ok, '010-E4 supports native circle');
expect(!buildTrochoidalContourGuide(rectangle, { ...operation, entryMode: 'plunge' as 'ramp' }).ok, 'contract remains fail closed');
console.log('010-B semantic guide: PASS');
