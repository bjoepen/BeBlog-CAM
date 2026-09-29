import { constructAssumedDiskFromCircularSweep } from '../../src/lib/trochoidalConstructiveSeed';
import { proveAssumedSeedClearance } from '../../src/lib/trochoidalSeedClearance';
import type { SemanticSegment } from '../../src/lib/contourMath';

const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const center = { x: 5, y: -3 };
const prior: SemanticSegment[] = [
  { kind:'arc', start:{x:6,y:-3}, end:{x:4,y:-3}, center, radius:1, ccw:true },
  { kind:'arc', start:{x:4,y:-3}, end:{x:6,y:-3}, center, radius:1, ccw:true }
];
const derived = constructAssumedDiskFromCircularSweep(prior, 3, 2);
expect(derived.ok, `previous circular sweep: ${derived.errors.join('; ')}`);
if (derived.ok) {
  expect(Math.abs(derived.disk.radiusMm - (4-1e-6)) < 1e-12 && derived.disk.clearedToDepthMm === 2,
    'union of cutter disks covers center through outer radius');
  const future: SemanticSegment[] = [{ kind:'line', start:{x:4,y:-3}, end:{x:6,y:-3} }];
  expect(proveAssumedSeedClearance(derived.disk, future, 1, 1).ok,
    'derived conditional disk supplies E5B geometric clearance');
  expect(!proveAssumedSeedClearance(derived.disk, future, 1, 3).ok,
    'future depth cannot exceed assumed previous cut');
  expect(!proveAssumedSeedClearance(derived.disk, [
    { kind:'line', start:{x:8,y:-3}, end:{x:9,y:-3} }
  ], 1, 1).ok, 'future cutter envelope outside prior sweep fails');
}
const clockwise = prior.map(segment => segment.kind === 'arc' ? { ...segment, ccw:false } : segment);
expect(constructAssumedDiskFromCircularSweep(clockwise, 3, 2).ok, 'clockwise full sweep works');
expect(!constructAssumedDiskFromCircularSweep(prior, .5, 2).ok, 'annular hole fails');
expect(!constructAssumedDiskFromCircularSweep(prior, 1, 2).ok, 'zero inner margin fails');
expect(!constructAssumedDiskFromCircularSweep(prior, 3, NaN).ok, 'invalid depth fails');
expect(!constructAssumedDiskFromCircularSweep(prior.slice(0, 1), 3, 2).ok, 'partial sweep fails');
const gap: SemanticSegment[] = [prior[0], { ...prior[1], start:{x:4.1,y:-3} } as SemanticSegment];
expect(!constructAssumedDiskFromCircularSweep(gap, 3, 2).ok, 'broken sweep fails');
const inconsistent: SemanticSegment[] = [prior[0], { ...prior[1], center:{x:5.1,y:-3} } as SemanticSegment];
expect(!constructAssumedDiskFromCircularSweep(inconsistent, 3, 2).ok, 'nonconcentric sweep fails');
console.log('010-E5C constructive assumed disk: PASS');
