# 004T-A — Initial Job Safe Entry

## Finding

A complete overall-job export could begin by posting the first materialized operation motion directly. Because `postCanonicalMachineMotions()` emits motion end points, the first operation's `motion.start` anchor was not itself established in NC before the first plunge/cut motion.

## Contract

Before the first operation motion of an exported overall job:

1. A materialized first preflight motion MUST exist.
2. Its `start.z` MUST equal the first operation's configured `safeZMm`.
3. NC MUST first establish Safe-Z with a Z-only rapid.
4. Only after Safe-Z is established may NC position X/Y to the first motion start anchor.
5. The spindle/first operation motion sequence follows afterwards.
6. Missing or unsafe first anchors fail closed and block export.

## Important boundary

The machine's actual X/Y position before program start is unknown to CAM. Therefore 004T-A does not fabricate a canonical XYZ segment from an invented machine position. The Z-only Safe-Z establishment and subsequent XY positioning are a deterministic job-entry preamble.

From the established first operation start anchor onward, the existing invariant remains:

`Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.`

## Non-goals

- no CAM-path reconstruction
- no change to operation geometry
- no stock-removal simulation
- no semantic reinterpretation of canonical motions
- no weakening of existing 004T operation or inter-operation transition checks
