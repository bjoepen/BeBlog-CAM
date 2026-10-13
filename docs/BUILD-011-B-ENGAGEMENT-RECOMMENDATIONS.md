# Build 011-B – Schnittdaten: advisory engagement ranges

## Scope
Pure TypeScript function `recommendCuttingEngagement` in `src/lib/cuttingEngagementRecommendation.ts`.
No UI changes, no operation transfer, no NC changes, no alterations to `feedsSpeeds.ts` or existing preflight safety rules.

This is a **heuristic starting point**, NOT a verified machining limit, spindle load model or a substitute for tool manufacturer data.
Inputs: material, endmill geometry, operation and qualitative machine rigidity.
Outputs: optional recommended radial/axial ranges in mm with basis and notes; unsupported combinations explicitly return `unavailable`.

Only flat endmills (`end-mill`) and milling operations in the supported set receive numerical recommendations. Drilling, engraving, ballnose, face mills etc. are not assigned arbitrary equivalents. No implicit mutation of manual values.

## Validation
`node scripts/check-011b-cutting-engagement.mjs` (requires pnpm in PATH).
Acceptance covers ordered ranges, rigidity response, cutting-length cap, unsupported tool/method, invalid diameter, immutability and preservation of the independent 140° trochoidal policy.

## Follow-up: 011-C
Replace illustrative starting factors with documented manufacturer- and machine-specific evidence. Compare selected single-variable cases against Millalyzer Static as an independent model reference, **not** as experimental ground truth. Add explicit rationale and manual WARN thresholds only once evidence is sufficient.

## Safety
All existing canonical toolpath, collision and manufacturing release gates remain unchanged. The advisory engine is not wired into manufacturing and cannot override the trochoidal material exposure boundary.
