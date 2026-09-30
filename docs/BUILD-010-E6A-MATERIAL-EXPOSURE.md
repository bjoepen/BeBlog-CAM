# Build 010-E6A — Conditional Material Circumference Exposure

E6A provides a quantitative upper bound on the total cutter circumference that can lie in material at a selected depth. Its model assumes one previously cleared cylindrical disk, and treats **all** space outside that disk as uncut stock. It credits no material removal by the candidate itself. This is conservative if the seed really is cleared: further removal and a finite blank can only reduce exposure. The disk must extend through the requested depth and be larger than the cutter with reserve.

For a cleared radius `S`, cutter radius `R`, and center distance `d`, the exposed sector is zero for `d + R ≤ S`, 360° for `d ≥ S + R`, and otherwise:

`exposedAngle = 2 acos((S² - d² - R²) / (2dR))`.

For `S > R`, the cosine threshold decreases strictly with `d`, so exposure increases monotonically. E6A uses the exact radial maximum of every native LINE/ARC segment, including arc-interior extrema, to bound the entire continuous path. It subtracts a 0.000001 mm disk reserve, pads center distance by 0.0000001 mm, and biases floating-point angle evaluation toward greater exposure. Coordinates exceeding the numeric reserve budget fail closed. Invalid topology/data yields no measurement (`null`), while a valid path exceeding the caller's policy still reports its full-path maximum and first exceeded segment. The reference policy must be at least 0° and strictly below 180°; fixture thresholds are test inputs, not cutting recommendations.

Acceptance includes zero exposure, an analytical partial-material cap, later full immersion, arc-interior failures, opposite arc winding, rotation/translation, E5D-to-E6A composition, malformed input and the whole 010-C loop/link reference. The latter reaches the conservative 360° bound despite a cleared first loop and is rejected. The new check is included in CI.

**Release boundary:** this measures material-covered *circumference*, not feed-relative radial engagement in millimetres, cutting force, chip thickness, sustained full-slot avoidance, ramp safety or protected-part clearance. It assumes the declared seed and a common coordinate frame; E5D's canonical source is planned history, not proof of execution. A successful bound does not authorize a manufacturing operation, UI, preview, preflight, persistence or NC output. Planned-history context/order, first-layer entry, adaptive clearing and engagement-aware candidate generation remain future work.
