# Changelog - tycoon-token

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CON-1037

### Added
- **Migration & upgrade governance** — Admin-controlled state version migration system
  - `migrate()` entrypoint for upgrading contract state (admin-only)
  - `state_version()` public query function
  - StateVersion tracking in contract storage (v0 → v1 migration support)
  - Comprehensive migration tests (MIG-01 through MIG-12)
  - Documentation in README for migration workflows and security model

### Changed
- `initialize()` now sets StateVersion to 1 on new deployments
- DataKey enum extended with StateVersion variant

## [Unreleased] - SW-CT-004

### Added
- `ACCEPTANCE_CRITERIA.md` — full functional and non-functional acceptance criteria for the tycoon-token contract, covering all entrypoints, invariants, test coverage checklist, and rollout/migration notes.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
