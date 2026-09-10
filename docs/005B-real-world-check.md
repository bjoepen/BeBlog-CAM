# Build 005B / 004T-A Real-World Check

Use the same simple rectangle job that exposed the initial-entry issue.

## Expected NC start

After modal setup, the exported overall job must establish the first operation start anchor in this order:

```gcode
G21
G90
G17
G0 Z<safe-z>
G0 X<start-x> Y<start-y>
M3 S<rpm>
...
```

The first plunge/cut motion may only appear after those two positioning commands.

## Verify

- no initial simultaneous `G0 X... Y... Z...`
- no first `G1` plunge before Safe-Z and XY positioning
- existing retracts between depth levels remain intact
- existing inter-operation transitions remain intact
- 005B play/pause/reset/speed still pass
- orbit/pan/zoom still pass
- generated NC remains accepted by the intended controller/postprocessor workflow
