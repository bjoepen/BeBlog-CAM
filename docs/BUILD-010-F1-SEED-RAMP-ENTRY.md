# Build 010-F1 — Conditional Linear Seed Ramp Entry

F1 constructs native canonical `line3` entry segments within an assumed, already-cleared cylinder. It does not create a seed by ramping into previously uncut stock. Seed provenance and initial excavation remain separate unresolved requirements.

The endpoint is the internally generated first trochoid apex. Its reflection through the seed center defines a straight pendulum chord. An even number of legs begins and ends at the apex, descending monotonically from the supplied start depth to the exact target depth. The maximum angle determines how many complete pairs are needed; actual angles can be smaller. Each emitted move receives the explicit ramp feed. Every reversal occurs within the protected seed; tangential blending and machine dynamics are not proven.

Finite positive data, clear target depth, maximum angle in (0,15] degrees, a nondegenerate chord, cutter reserve, coordinate precision and a 2048-leg limit are required. Every emitted move must strictly descend and obey the angle limit. E5B independently proves the full projected cutter footprint remains within the seed through target depth. No partial moves are returned on failure.

The combined reference API first runs E6E's protected material assessment and then constructs the entry ending at its exact first-loop XY position and target Z. The seed's full source protection therefore covers the ramp too. Ramp failure discards both entry and material reference. No additional removal or deeper clearance is credited to the ramp.

Acceptance covers a 1 mm drop at a 3 degree maximum (four 8 mm legs), per-move slope/feed/depth/continuity, independent dense cutter-disk samples, immutable inputs, previous-layer start depth, segment-budget and invalid-data rejection. Combined transformed circle/capsule fixtures cover inside/outside and both loop windings, exact entry/path continuity, unchanged loop geometry, overlapping-seed rejection and failure atomicity. `check:010f1` runs in CI.

Release boundary: one target layer with assumed prior clearance. Safe-Z approach/retract, tangential transitions, stock-cutting entry, seed provenance, full multi-depth orchestration, general contours/corners, UI, persistence, preflight and NC release remain closed. This is geometric reference evidence, not machine execution approval. Fixture values are not cutting recommendations.
