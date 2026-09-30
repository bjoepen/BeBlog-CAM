# Build 010-F9 — Spoilboard Clearance

F9 adds the setup boundary below the workpiece for trochoidal through-cuts.

- Setup may define an explicit spoilboard thickness.
- Only the requested stock-bottom overcut consumes spoilboard reserve; workpiece thickness remains F8 authority.
- Trochoidal overcut greater than zero requires a defined spoilboard before job preflight can release the canonical toolpath.
- Overcut beyond the available spoilboard fails closed.
- Manual cuts without overcut do not require a spoilboard.
- Machine-envelope and fixture checks remain independent outer safety authorities.

F9 does not infer a machine-bed position from spoilboard thickness. The machine envelope remains responsible for absolute machine travel and limit safety.
