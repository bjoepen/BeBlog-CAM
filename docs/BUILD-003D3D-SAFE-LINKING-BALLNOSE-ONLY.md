# Build 003D3d — Safe Linking + Ballnose-only Contract

## Goal

Turn the proven 003D3c finishing chains into a conservative machine-motion
sequence and enforce a ballnose-only tool contract for `3D Schlichten`.

## Safe linking

Each independent finishing chain uses:

1. safety height (`safeZMm`)
2. rapid traverse at safety height
3. controlled entry using `plungeMmMin`
4. compensated 3D finishing using `feedMmMin`
5. rapid retract to safety height

Disconnected chains are never linked directly through model space.

## Tool restriction

`3D Schlichten` allows only `ball-nose`.

The restriction is enforced at:

- tool-type selection UI
- App transfer boundary
- existing compatibility validation

## Gate

- Vollradiusfräser selectable and transferable
- all other tool kinds disabled for target `3D Schlichten`
- existing finishing geometry unchanged
- safeZ changes only linking/retract height
- every independent chain retracts before the next chain
