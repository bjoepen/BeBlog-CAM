# 004T-A Parity Boundary

The pre-program machine X/Y position is external state and is not known to CAM. Therefore the initial Z-only Safe-Z establishment and subsequent XY positioning are job-entry state-establishment commands, not fabricated canonical XYZ geometry.

The canonical motion parity invariant begins once the first materialized operation start anchor has been established:

`Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.`

This keeps the invariant truthful instead of inventing an unknown machine start point merely to make the preview draw a segment that CAM cannot know.
