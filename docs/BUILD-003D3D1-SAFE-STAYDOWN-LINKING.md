# Build 003D3d1 — Safe Stay-down Linking

## Goal

Reduce unnecessary retracts between adjacent parallel ballnose finishing chains
without sacrificing the safety contract from 003D3d.

## Rule

A stay-down link is allowed only when:

1. the next chain is locally adjacent,
2. the XY transition distance stays below a conservative local threshold,
3. every sampled intermediate XY point resolves to a valid ballnose contact on
   the selected curved face.

If any condition fails, the cutter retracts to `safeZMm`.

## Stay-down path

For an accepted link:

- interpolate between the end of the current chain and the beginning of the
  next,
- evaluate each intermediate point with `ballnoseContactAt`,
- use the compensated ball-center positions,
- emit `line3` motions at finishing feed.

The link therefore follows the selected surface instead of cutting a straight
3D shortcut through model space.

## Fallback

Disconnected regions, large gaps or invalid surface samples retain the full
safe sequence:

- retract to safe Z
- rapid XY traverse
- controlled plunge
- continue finishing

## Gate

On the headstock cove:

- most adjacent raster rows should link without full retract,
- no long diagonal shortcuts are allowed,
- disconnected areas must still retract,
- first entry and final exit still use safety Z,
- changing stepover must not create unsafe cross-surface links.
