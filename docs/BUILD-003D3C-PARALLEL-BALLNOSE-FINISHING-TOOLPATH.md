# Build 003D3c — Parallel Ballnose Finishing Toolpath

## Goal

Generate the first real canonical 3D finishing path for an operation-owned selected STEP/BRep surface.

Pipeline:

selected faceIds → CurvedFaceTarget Z(x,y) → local surface normal → compensated ballnose center → Parallel X/Y scan → canonical XYZ motions → STEP preview

## Why XYZ motions

A finishing path has varying Z along one continuous cut. It therefore must not be represented as a planar run with one constant Z. 003D3c uses the existing CanonicalMachineMotion / line3 contract so every segment keeps its real X, Y and Z coordinates.

## Scope

003D3c provides operation-owned canonical 3D finishing geometry and active STEP preview. Prüfen and NC export remain intentionally blocked until linking, retract and post rules are approved in the next gate.

## Gate

- choose 3D Schlichten
- choose the cove face
- use a ballnose tool
- verify finishing paths appear on the selected surface
- Parallel X/Y changes path direction
- stepover changes path density
- paths follow the curved surface in Z
- no path appears on unselected areas
- orbit/pan/zoom preserves registration
