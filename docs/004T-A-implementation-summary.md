# 004T-A Implementation Summary

The fix is intentionally narrow:

- no CAM geometry changes
- no operation toolpath reconstruction changes
- no changes to 005A/005B motion consumption
- overall-job export validates first preflight motion start anchor
- export fails closed if the anchor is absent or not on configured Safe-Z
- export establishes Safe-Z with Z-only rapid before any XY start positioning
- export positions XY to the known first operation start anchor before spindle/operation motions
- CI includes static 004T, 004T-A contract, 004T-A sequence, 005A and 005B gates
