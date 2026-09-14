# QA Policy

## Purpose

BeBlog CAM separates repository CI from native macOS QA. GitHub Actions is used for fast, deterministic, repository-level checks. Native application acceptance is performed locally on the real macOS target system.

## Binding rule

**If a QA gate can and should be validated on the native macOS target system, it is not duplicated in GitHub Actions. It is executed locally on macOS.**

This rule is binding for BeBlog CAM and must not be reversed by reintroducing equivalent native macOS QA jobs into GitHub Actions.

## GitHub Actions scope

GitHub Actions may run checks that are platform-appropriate, deterministic, and useful as repository regression protection, including:

- TypeScript / Svelte checks
- frontend build
- Rust compile/check without native production-only dependencies
- unit tests and contract tests
- synthetic acceptance tests that do not require the native macOS application/runtime
- production-path invariants that can be validated without native macOS-only infrastructure

GitHub Actions is not the production acceptance environment for BeBlog CAM.

## Local macOS QA scope

The following are local-only QA gates and are validated on the real macOS development/target machine:

- native Tauri application build and launch
- production build with `occt-native`
- native OCCT / STEP import and geometry processing
- STEP Master Fixture acceptance (Build 008A3)
- native library/linkage behavior
- `.app` / DMG production packaging where applicable
- macOS-specific runtime behavior
- real-world acceptance jobs and external verification such as Estlcam checks

A plain GitHub runner PASS is not a substitute for these local gates, and a GitHub runner must not be used to reproduce them.

## Build 008A application

For Build 008A:

- 008A1 Acceptance Harness: GitHub-capable
- 008A2 Synthetic 2D/2.5D Suite: GitHub-capable
- 008A3 STEP Master Fixture: **local macOS QA only**
- 008A4 Multi-Operation Job: evaluated according to this policy; native portions local
- 008A5 Estlcam Contract: repository-level structural checks may run in CI; native/external acceptance remains local
- 008A6 Real-World Acceptance: local/manual by definition

008A3 remains a required acceptance gate. Only its execution location changes: it must be passed locally before 008A4 is opened.

## Production build rule

The valid native production build includes `occt-native`. A plain `pnpm tauri build` without the required native feature is not considered the production macOS acceptance build.

## Non-regression rule

Do not add a GitHub Actions job for native STEP/OCCT/macOS acceptance in the future. If CI needs additional coverage, add only platform-neutral or synthetic checks and keep native acceptance local.
