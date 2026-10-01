# Build 010-F10 — Physical Cut Direction

F10 makes trochoidal cut direction side-aware for the existing M3 spindle convention.

- climb outside -> CW contour traversal
- climb inside -> CCW contour traversal
- conventional outside -> CCW contour traversal
- conventional inside -> CW contour traversal
- mirrored input geometry is normalized from its actual signed winding, not from source assumptions
- source and cutter-center guide are reversed together when normalization is required
- local trochoid loop winding is derived from the resolved free side so motion at the guide-touch point advances with the oriented guide
- direction resolution is immutable and runs before the existing canonical/safety pipeline

F10 does not change protected-envelope, material-exposure, depth, spoilboard, fixture, or machine-envelope authorities.
