# 001Z-E — Safe Raster Linking / Retract Optimization

## Problem

The first Face-Target Z-Level proof emitted one canonical run per raster segment.

The postprocessor therefore performed:

`retract → rapid XY → plunge`

after almost every raster line.

This was geometrically safe but unnecessarily expensive.

## Strategy

Raster segments are now ordered as a true serpentine path.

Adjacent segments are joined into one canonical cutting chain only if the
**complete center-line connector** remains inside the cutter-safe Face-Target
region.

The connector is sampled against the same rules used for raster generation:

- point must remain inside the even/odd Face-Target region,
- cutter-center clearance to every boundary must remain at least tool radius.

## Safety invariant

A connector that crosses:

- an inner opening,
- an island,
- the outer Face-Target boundary,
- a disconnected region,

is rejected.

Rejected connectors end the current cutting chain and therefore retain the
safe-Z retract before the next chain.

## Expected effect

For a simple rectangular Face Target:

- one continuous serpentine cutting chain per Z-level,
- one plunge per Z-level rather than one plunge per raster row.

For geometry with holes/islands:

- continuous chains where geometrically safe,
- retracts only where the topology requires them.

## Unchanged

- Z-level ordering,
- Face-Target boundary semantics,
- tool-radius clearance,
- WCS coordinates,
- finish allowance,
- postprocessor contract.
