import { assessChipThickness, assessAdvisoryRange } from '../../src/lib/chipThicknessAdvisory';
const check = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
const base = { cutterDiameterMm: 3, radialWidthMm: 0.3, fluteCount: 1,
  spindleRpm: 12000, programmedFeedMmMin: 150, targetChipThicknessMm: 0.025, maxFeedMmMin: 1000 };
const a = assessChipThickness(base);
check(a.status === 'advisory', 'valid radial cut');
if (a.status === 'advisory') {
  check(Math.abs(a.chipThicknessFactor - 0.6) < 1e-6, 'ae/D 0.1 factor 0.6');
  check(Math.abs(a.programmedToothFeedMm - 0.0125) < 1e-6, 'fz from feed');
  check(Math.abs(a.estimatedMaxChipThicknessMm - 0.0075) < 1e-6, 'actual max h');
  check(Math.abs(a.compensatedFeedMmMin! - 500) < 1e-6, 'suggested feed compensation');
  check(!a.feedCapActive, 'uncapped recommendation');
}
const half = assessChipThickness({ ...base, radialWidthMm: 1.5 });
const full = assessChipThickness({ ...base, radialWidthMm: 3 });
check(half.status === 'advisory' && half.chipThicknessFactor === 1, 'half immersion factor 1');
check(full.status === 'advisory' && full.chipThicknessFactor === 1, 'full immersion factor 1');
const noTarget = assessChipThickness({ ...base, targetChipThicknessMm: undefined });
check(noTarget.status === 'advisory' && noTarget.compensatedFeedMmMin === null, 'never invent target');
const capped = assessChipThickness({ ...base, maxFeedMmMin: 300 });
check(capped.status === 'advisory' && capped.feedCapActive && capped.compensatedFeedMmMin === 300, 'limit applied');
check(assessChipThickness({ ...base, radialWidthMm: 3.01 }).status === 'unavailable', 'overwidth unavailable');
check(assessChipThickness({ ...base, fluteCount: 0 }).status === 'unavailable', 'invalid tooth count');
check(assessChipThickness({ ...base, programmedFeedMmMin: NaN }).status === 'unavailable', 'invalid feed');
check(assessAdvisoryRange(0.6, { minMm: 0.5, maxMm: 0.8 }).level === 'pass', 'in range');
check(assessAdvisoryRange(1.1, { minMm: 0.5, maxMm: 0.8 }).level === 'warn', 'out of range warns');
check(assessAdvisoryRange(-1, { minMm: 0.5, maxMm: 0.8 }).level === 'unavailable', 'invalid cannot pass');
check(base.programmedFeedMmMin === 150, 'input unchanged');
console.log('011-C chip thickness advisory: PASS');
