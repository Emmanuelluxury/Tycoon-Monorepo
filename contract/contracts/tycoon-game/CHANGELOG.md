# Changelog - tycoon-game

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CT-011

### Added
- `deprecated_entrypoints_tests.rs` — 11 tests (DEP-01 – DEP-11) verifying the
  deprecation path for legacy entrypoints introduced in v0.2.0:
  - DEP-01: `migrate` shim delegates to `admin_migrate`; no-op at v1.
  - DEP-02: `withdraw_funds` shim transfers tokens and emits `FundsWithdrawn` event
    (previously `#[ignore]`; confirmed functional in the `#[no_std]` test context).
  - DEP-03: `set_collectible_info` shim stores and retrieves metadata correctly.
  - DEP-04: `set_cash_tier_value` shim stores and retrieves cash tier value.
  - DEP-05: `set_backend_game_controller` shim updates controller; visible via `export_state`.
  - DEP-06: `mint_registration_voucher` shim exists and delegates (compile check).
  - DEP-07 – DEP-11: each shim still enforces admin-only access (auth not bypassed).

## [Unreleased] - SW-CT-010

### Added
- `ACCEPTANCE_CRITERIA.md` — full functional and non-functional acceptance criteria
  for the tycoon-game contract, covering lifecycle, admin-only entrypoints, public
  entrypoints, deprecated shims, treasury invariant, test coverage checklist, and
  rollout / migration notes.
- `README.md` — comprehensive developer documentation covering architecture, public
  interface, treasury model, events, storage layout, security model, build/test
  instructions, and usage examples.

## [Unreleased] - SW-CT-008

### Added
- `game_coverage_tests.rs` — 6 integration tests (GCT-01 – GCT-06) covering
  paths not exercised by the primary `test.rs` suite or simulation scenarios:
  - GCT-01: `withdraw_funds` event data equals withdrawn amount.
  - GCT-02: Sequential TYC then USDC withdrawals update each balance independently.
  - GCT-03: `remove_player_from_game` succeeds for owner when no backend controller is set.
  - GCT-04: `export_state` reflects backend controller address after it is set.
  - GCT-05: `migrate` advances v0 → v1; second call at v1 is a no-op.
  - GCT-06: `remove_player_from_game` event data equals the supplied `turn_count`.

## [Unreleased] - SW-CT-007

### Added
- `SECURITY_REVIEW_CHECKLIST.md` — full security review covering access control,
  CEI pattern, input validation, integer arithmetic, storage consistency, event
  emission, privileged roles, DoS/gas, and Soroban best practices for the
  tycoon-game contract. Includes six open items to resolve before mainnet.

## [Unreleased] - SW-CT-009

### Added
- `simulation_scenarios.rs` expanded with SIM-12 through SIM-20 (9 new scenarios):
  - SIM-12: Full player lifecycle — register then owner removes from game
  - SIM-13: Large collectible catalogue — 10 distinct token IDs stored and retrieved
  - SIM-14: All cash tiers set in one pass; each value independently correct
  - SIM-15: Partial USDC withdrawal leaves correct residual balance
  - SIM-16: Owner removes multiple players from the same game in sequence
  - SIM-17: Backend controller removes players across multiple concurrent games
  - SIM-18: Treasury invariant holds across multiple escrow cycles with varying stakes
  - SIM-19: Unregistered address returns `None` from `get_user`
  - SIM-20: `export_state` reflects reward_system address set during initialize
- Module doc-comment table updated to list all 20 scenarios.

## [0.2.0] - 2026-04-24 — SW-CT-012

### Added
- Formal `admin_*` entrypoints: `admin_migrate`, `admin_withdraw_funds`,
  `admin_set_collectible_info`, `admin_set_cash_tier_value`,
  `admin_set_game_controller`, `admin_mint_registration_voucher`.
- `require_admin` internal helper — single source of truth for owner auth.
- Separate `#[contractimpl]` blocks clearly labelled *Admin-only* and *Public*.
- `admin_access_control_tests` module (13 tests, ACT-01 – ACT-13) covering
  auth rejection for every admin entrypoint and backward-compat shims.

### Changed
- Admin-only functions now live in a dedicated `#[contractimpl]` block with
  doc comments; public functions are in a separate block.

### Deprecated
- Old entrypoint names (`migrate`, `withdraw_funds`, `set_collectible_info`,
  `set_cash_tier_value`, `set_backend_game_controller`,
  `mint_registration_voucher`) are kept as thin shims marked `#[deprecated]`
  and will be removed in v1.0.0.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
