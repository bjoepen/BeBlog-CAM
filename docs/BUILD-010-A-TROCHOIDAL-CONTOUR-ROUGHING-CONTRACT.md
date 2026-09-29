# Build 010-A — Trochoidal Contour Roughing Contract

## Status

Approved contract baseline for **Build 010 — Trochoidal Contour Roughing**.

This build defines the operation semantics and safety boundaries only. It does **not** generate, preview, post-process, or release a trochoidal manufacturing toolpath yet.

## Purpose

Trochoidal Contour Roughing is a dedicated 2.5D contour-roughing strategy intended to avoid sustained full-slot engagement, especially for aluminium machining.

The operation follows **exactly one contour target**. It is not a pocket-clearing strategy and must never silently turn into one.

## Canonical operation identity

- operation kind: `trochoidal-contour-roughing`
- canonical strategy: `trochoidal-contour`
- user-facing name: **Wirbelfräsen Kontur**
- supported tool in v1: **end mill only**

## Required v1 parameters

- one contour target
- contour side: `outside` or `inside`
- cut direction: `climb` or `conventional`
- trochoid radius in mm
- forward step per cycle in mm
- ramp angle in degrees
- total depth
- step-down
- feed
- plunge/ramp feed
- spindle speed
- safe Z
- optional radial allowance
- optional axial allowance

## Entry contract

Entry mode is fixed to **ramp** in v1.

For each depth level:

1. move to the proven start region at Safe Z,
2. ramp from the previous cleared depth to the target depth,
3. reach the target Z inside the allowed machining corridor,
4. transition into the first trochoidal cycle,
5. continue along the selected contour.

A vertical plunge is not a normal user-selectable v1 strategy.

The ramp itself is manufacturing geometry and must pass the same boundary/safety proof as the subsequent trochoidal motion.

## Geometry contract

The selected design contour remains authoritative.

The normal cutter-center contour is derived from:

- selected contour,
- inside/outside side,
- cutter radius,
- radial allowance.

The trochoidal motion is generated from that guide contour.

Additional oscillating motion may only use the explicitly allowed roughing/free side. The protected design-contour side must never be violated by the cutter envelope.

## Full-slot avoidance

The strategy exists specifically to avoid sustained 100% cutter-width slotting.

Build 010 shall therefore expose and validate the effective radial engagement produced by the chosen trochoid radius and forward step.

A later build may offer engagement-driven automatic parameter calculation. In v1, trochoid radius and forward step remain explicit inputs and the resulting engagement is validated.

No implementation may fall back to a conventional full-slot contour when trochoidal geometry cannot be proven safe.

## Corner policy

Corners and local curvature may require a reduced local trochoid radius.

The allowed behaviour is:

1. reduce the local trochoid radius while retaining the protected-side and engagement constraints;
2. if no valid radius remains above the defined minimum, fail closed.

Forbidden behaviour:

- clipping loops through the protected contour side,
- silently reverting to full-slot cutting,
- using an unproven shortcut through material.

## Supported scope for Build 010 v1

- 2D / 2.5D only
- exactly one contour target
- closed contour first
- DXF semantic LINE/ARC geometry first
- end mill only
- multi-depth machining
- mandatory ramp entry
- native canonical LINE/ARC motions
- G2/G3-capable canonical output

## Explicit non-goals

Build 010 is **not**:

- pocket clearing,
- adaptive clearing,
- rest machining,
- stock-aware pocket roughing,
- 3D roughing,
- multi-target contour roughing,
- an OCCT/BRep redesign,
- a feeds-and-speeds optimiser,
- a substitute for the existing normal contour operation.

Open contours, STEP contour integration, islands, automatic engagement-driven sizing, helix entry and stay-down depth transitions are follow-up scope unless explicitly approved later.

## Fail-closed requirements

Manufacturing release must fail when any of the following is unproven or invalid:

- no single valid contour target,
- unsupported/open topology in the current implementation stage,
- unsupported tool type,
- non-positive trochoid radius,
- non-positive forward step,
- invalid ramp angle,
- invalid depth or step-down,
- ramp leaves the allowed machining domain,
- trochoidal cutter envelope crosses the protected design side,
- local curvature cannot support a safe trochoid,
- requested engagement cannot be maintained safely,
- canonical toolpath or safe-motion materialisation is incomplete.

## Architecture boundary

The operation must produce a normal `CanonicalToolpath`.

The final path may use existing canonical line/arc and line3/arc3 primitives. No CanonicalToolpath v2 is required by this contract.

Existing post-processing, stock simulation, collision checks, safe-motion materialisation and job output must consume the same canonical manufacturing truth once later build stages enable production.

## 010-A acceptance

010-A passes when:

- the contract is present and executable as a repository check,
- the operation identity and parameter contract exist in code,
- defaults are deterministic and safe,
- validation rejects unsupported tool kinds and invalid parameter values,
- validation enforces exactly one contour target,
- validation fixes v1 entry semantics to ramp,
- no production toolpath generator is introduced,
- no existing CAM strategy semantics are changed.
