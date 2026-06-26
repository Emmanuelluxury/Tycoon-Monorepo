# Changelog - tycoon-token

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CT-006

### Added
- Doc comments on every entrypoint in `src/lib.rs` formally classifying it as
  **Admin-only** (`mint`, `set_admin` — guarded by `require_admin`),
  **Public** (`approve`, `transfer`, `transfer_from`, `burn`, `burn_from` —
  caller self-authenticates via `require_auth()`), or **Read-only** (`admin`,
  `total_supply`, `allowance`, `balance`, `decimals`, `name`, `symbol` — no
  auth required). Section header comments delineate the admin-only block
  from the public/SEP-41 block.
- No behavioral changes — `src/access_control_tests.rs` already exercises
  this admin-only vs. public boundary; this change makes the boundary
  explicit and self-documenting directly in the contract source.

## [Unreleased] - SW-CT-004

### Added
- `ACCEPTANCE_CRITERIA.md` — full functional and non-functional acceptance criteria for the tycoon-token contract, covering all entrypoints, invariants, test coverage checklist, and rollout/migration notes.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
