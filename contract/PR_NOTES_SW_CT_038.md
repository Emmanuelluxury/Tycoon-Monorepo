# PR: SW-CT-038 — integration-tests: unit / integration coverage

Closes #124

**Stellar Wave · Contract (Soroban / Stellar)**

## Summary

Adds `contract/integration-tests/src/unit_coverage.rs` — a new test module
that fills coverage gaps identified in the Stellar Wave batch review.

| New Test | Contract | Coverage Area |
|---|---|---|
| `game_initialize_twice_rejected` | tycoon-game | one-time init guard |
| `reward_initialize_twice_rejected` | tycoon-reward-system | one-time init guard |
| `game_collectible_info_roundtrip` | tycoon-game | set/get collectible info |
| `game_register_player_stores_name` | tycoon-game | player registration |
| `reward_two_vouchers_independent` | tycoon-reward-system | multi-voucher isolation |
| `token_mint_increases_balance` | SEP-41 token | mint correctness |
| `token_burn_decreases_balance` | SEP-41 token | burn correctness |
| `boost_initialize_twice_rejected` | tycoon-boost-system | one-time init guard |

## What was tested

- All tests use isolated `Env::default()` — no shared state.
- `cargo check` passes for all workspace members touched.

## Rollout / migration

No on-chain changes. Tests only — no migration or feature flag required.

## Acceptance Criteria

- [x] PR references Stellar Wave and SW-CT-038
- [x] `cargo check --workspace` passes
- [x] No unaudited oracle or privileged pattern introduced
