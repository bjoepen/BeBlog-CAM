# 004T-A Acceptance

A generated overall-job NC program must satisfy all of the following before merge:

- The first active preflight operation has a materialized first machine motion.
- That motion starts on the operation's configured Safe-Z.
- The first machine command after modal setup is a Z-only rapid to Safe-Z.
- XY positioning to the first operation start anchor happens only after Safe-Z establishment.
- The initial positioning command does not combine unknown starting X/Y with Z in one XYZ rapid.
- The spindle/first operation starts only after the safe start anchor has been established.
- Missing or unsafe first anchors block export.
- Existing 004T run-internal retracts and inter-operation transitions remain unchanged.
- 005A/005B continue to consume the already materialized preflight operation motions without reconstructing CAM.
