# Build 010-F4 — Multi-Depth Safe Transitions

F4 orchestrates the accepted F3 stock-entry reference across multiple absolute cutting depths. It does not weaken or replace any F3 material-engagement proof. Every depth level is rebuilt independently through F3 and earlier levels are deliberately not credited as cleared material.

A positive total depth and step-down produce a bounded schedule of at most 512 levels. Each level depth is `min(totalDepth, n * stepDown)`, so the last level is shortened exactly when required. F4 passes that absolute depth into F3; startup, bootstrap seed and protected contour therefore share one depth contract for the level.

Safe-Z is explicitly above the workpiece surface and must be positive. After a completed level the cutter retracts vertically from the contour endpoint to Safe-Z. Before the next level, lateral positioning occurs only at Safe-Z; the cutter then descends vertically to the stock surface at the next F3 entry point. The F3 ramp owns the subsequent stock-surface-to-target-depth cutting entry. Positioning feed is explicit and finite.

Construction is atomic. All F3 levels are validated before any F4 level chain is returned. If any later level fails geometry, engagement or budget checks, the result contains no partial levels. Inputs remain immutable.

Acceptance covers transformed native circles/capsules, inside/outside and both loop windings. A 2.4 mm total depth with 1 mm step-down proves the exact 1 / 2 / 2.4 mm schedule, independent F3 reconstruction at every absolute depth, vertical approach/retract, lateral Safe-Z-only transitions and immutable inputs. Rejection covers invalid depth/step-down/Safe-Z/feed, level-budget exhaustion and inherited F3 engagement failure.

Release boundary: F4 is still internal reference geometry. Safe-Z is relative to the workpiece surface only; fixture/clamp clearance is not inferred or certified. Actual stock topology, cutter cutting length, machine dynamics, load/chip thickness, job/UI/persistence/preflight integration and NC release remain open. Fixture values and feeds in acceptance are not cutting recommendations.
