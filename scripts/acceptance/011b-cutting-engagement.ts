import { recommendCuttingEngagement } from '../../src/lib/cuttingEngagementRecommendation';

const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const base = { material: 'aluminium', toolKind: 'end-mill', diameterMm: 3,
  cuttingLengthMm: 10, operation: 'pocket', machineRigidity: 'light' } as const;
const first = recommendCuttingEngagement(base);
assert(first.status === 'advisory' && first.radial && first.axial, 'base yields advisory ranges');
if (first.radial && first.axial) {
  assert(first.radial.minMm <= first.radial.preferredMm && first.radial.preferredMm <= first.radial.maxMm, 'radial ordered');
  assert(first.axial.minMm <= first.axial.preferredMm && first.axial.preferredMm <= first.axial.maxMm, 'axial ordered');
  assert(first.axial.maxMm <= base.cuttingLengthMm, 'cutting length caps ap');
}
const stronger = recommendCuttingEngagement({ ...base, machineRigidity: 'rigid' });
assert(stronger.radial && first.radial && stronger.radial.preferredMm > first.radial.preferredMm, 'rigidity changes ae');
assert(stronger.axial && first.axial && stronger.axial.preferredMm > first.axial.preferredMm, 'rigidity changes ap');
const short = recommendCuttingEngagement({ ...base, cuttingLengthMm: 0.1 });
assert(short.axial && short.axial.maxMm <= 0.1, 'short flute clips ap');
const unsupported = recommendCuttingEngagement({ ...base, toolKind: 'ball-nose' });
assert(unsupported.status === 'unavailable' && unsupported.radial === null && unsupported.axial === null, 'unsupported tool no invented values');
assert(recommendCuttingEngagement({ ...base, operation: 'drill' }).status === 'unavailable', 'drill not treated as milling');
assert(recommendCuttingEngagement({ ...base, diameterMm: NaN }).status === 'unavailable', 'NaN fails closed');
assert(recommendCuttingEngagement({ ...base, diameterMm: -3 }).status === 'unavailable', 'negative diameter fails closed');
const trochoid = recommendCuttingEngagement({ ...base, operation: 'trochoidal-contour-roughing' });
assert(trochoid.notes.some(n => n.includes('140°')), 'existing safety boundary is acknowledged');
assert(JSON.stringify(base) === JSON.stringify({ material: 'aluminium', toolKind: 'end-mill', diameterMm: 3,
  cuttingLengthMm: 10, operation: 'pocket', machineRigidity: 'light' }), 'input unchanged');
console.log('011-B cutting engagement recommendations: PASS');
