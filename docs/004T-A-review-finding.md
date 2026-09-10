# 004T-A Review Finding

- **ID:** 004T-F01
- **Category:** Safe Motion / overall-job entry
- **Severity:** High
- **Confidence:** High
- **Status:** Fixed on `build/005b-simple-job-simulation`; pending CI and Real-World PASS

## Observation

The first materialized operation motion can begin at a valid Safe-Z start anchor while overall-job NC export posts only the motion end point. Without an explicit job-entry preamble, the controller is never commanded to establish that start anchor before the first plunge/cut move.

## Risk

The first cutting/plunge move can be issued from an unknown machine position. This violates the intended 004T safe-entry model even though run-internal retracts and inter-operation transitions remain valid.

## Resolution

Overall-job export now fails closed unless the first preflight motion exists and starts on configured Safe-Z, then emits a Z-only Safe-Z command followed by XY positioning to the first start anchor before spindle/operation motion output.
