# Build 004T — Complete Safe Motion Chain v1

## Goal

Remove the remaining safety gap between canonical cutting geometry and the motions that the machine actually needs to execute.

004T introduces a deterministic motion materializer that can turn run-based canonical toolpaths into an explicit XYZ motion chain containing approach, plunge/entry, cutting motion, retract and safe XY linking moves.

## Contracts

- run-based canonical toolpaths can be materialized into `CanonicalMachineMotion[]`
- safe-Z is explicit and finite
- every generated motion must connect exactly to the previous motion; no teleporting is accepted
- each run receives an explicit approach and retract path
- existing explicit XYZ motion owners (notably drilling/helix/surface toolpaths) remain authoritative and are continuity-checked instead of silently reconstructed from weaker geometry
- each operation exposes a safe start anchor and safe end anchor
- job-level links connect consecutive operations at the larger of their two safety-Z values
- 004S can consume the resulting explicit `motions` chain instead of falling back to runs + entry/exit approximations

## Current stage

This first 004T stage establishes the canonical planner and contract gate. The following integration stage must make Job Preflight and the NC posting path consume the same materialized motion truth so that the safety representation and emitted machine program cannot diverge.

## Deliberate limits

004T v1 is a Cartesian 3-axis motion contract. It does not yet model spindle-nose swept solids, rotary axes or controller-specific machine-state acquisition.

## Local-first gates

```bash
pnpm check:004t
pnpm check
pnpm build
```

No OCCT/native changes are required for this build stage.
