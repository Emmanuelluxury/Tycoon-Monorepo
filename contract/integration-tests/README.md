# Soroban Contract Integration Tests

> **Stellar Wave** · SW-CON-003 · SW-CON-004 · SW-CON-005

## Overview

This directory contains cross-contract integration tests for the Tycoon Soroban smart contracts. The tests verify realistic end-to-end flows that cannot be adequately covered by unit tests alone.

## Test structure

```
integration-tests/
├── Cargo.toml
├── README.md                        # This file
├── ACCEPTANCE_CRITERIA.md           # Acceptance criteria per scenario
├── TEST_SCENARIOS.md                # Detailed scenario documentation
├── IMPLEMENTATION_SUMMARY.md        # Implementation notes
├── PR_TEMPLATE.md                   # PR template
├── src/                             # Library modules (compiled into test binary)
│   ├── lib.rs                       # Module declarations
│   ├── fixture.rs                   # Shared Fixture::new() helper
│   ├── simulation_scenarios.rs      # SW-CON-003: end-to-end simulations
│   ├── legacy_entrypoints.rs        # SW-CON-005: deprecation-path tests
│   ├── game_reward_flow.rs
│   ├── game_token_flow.rs
│   ├── multi_player_flow.rs
│   ├── reward_transfer_flow.rs
│   ├── boost_admin_flow.rs
│   ├── boost_system_integration.rs
│   ├── security_review_checklist.rs
│   └── token_reward_flow.rs
└── tests/                           # Standalone integration test binaries
    ├── cross_contract_integration.rs
    ├── token_interactions.rs
    ├── game_flow.rs
    ├── reward_system_integration.rs
    └── collectibles_integration.rs
```

## Running the tests

```bash
# All tests (unit + integration)
cd contract
cargo test --all

# Integration-tests crate only
cargo test -p tycoon-integration-tests

# Specific scenario file
cargo test -p tycoon-integration-tests simulation_scenarios

# With stdout
cargo test --all -- --nocapture
```

## Scenarios

### simulation_scenarios.rs (SW-CON-003)

End-to-end flows across the full contract suite. Each scenario is isolated (`Fixture::new()` creates a fresh env).

| # | Name | What it verifies |
|---|------|-----------------|
| 1 | `voucher_transfer_then_redeem` | A → B transfer then redeem; balances exact |
| 2 | `backend_minter_lifecycle` | set → mint → clear → mint rejected |
| 3 | `owned_token_count_tracks_mint_transfer_redeem` | count invariant across lifecycle |
| 4 | `game_export_state_reflects_live_config` | snapshot matches init values |
| 5 | `reward_transfer_blocked_when_paused` | transfer rejected; succeeds after unpause |
| 6 | `game_migrate_is_idempotent` | migrate on v1 is a no-op |
| 7 | `sequential_voucher_ids_are_unique` | each mint returns a distinct, increasing ID |
| 8 | `reward_fund_survives_partial_redemptions` | partial redemptions leave correct residual |
| 9 | `multi_voucher_batch_then_bulk_redeem` | batch mint, out-of-order redeem |
| 10 | `game_collectible_update_overwrites` | second write wins |
| 11 | `cash_tier_independent_slots` | tiers don't bleed into each other |
| 12 | `player_data_persists_after_game_removal` | user record survives session removal |
| 13 | `admin_withdraw_funds_reduces_contract_balance` | withdraw amount exact (SW-CON-003) |
| 14 | `reward_redeem_blocked_when_paused` | redeem rejected when paused (SW-CON-003) |
| 15 | `backend_minter_replaced_old_minter_rejected` | replace atomically revokes old (SW-CON-003) |
| 16 | `boost_grant_and_query_cross_contract` | grant boost; get_boosts reflects it (SW-CON-003) |
| 17 | `multi_player_independent_vouchers` | three players' vouchers are independent (SW-CON-003) |
| 18 | `admin_only_entrypoints_require_auth` | non-admin call is rejected (SW-CON-003) |

### legacy_entrypoints.rs (SW-CON-005)

Deprecation-path tests for legacy entrypoints.

| # | Name | What it verifies |
|---|------|-----------------|
| 1 | `legacy_redeem_voucher_always_panics` | `redeem_voucher` always panics |
| 2 | `legacy_redeem_voucher_does_not_transfer_tokens` | no TYC moves on deprecated call |
| 3 | `canonical_redeem_voucher_from_still_works_after_legacy_attempt` | canonical path unaffected |
| 4 | `test_mint_entrypoint_is_unguarded_canary` | documents unguarded test helper |
| 5 | `test_burn_entrypoint_is_unguarded_canary` | documents unguarded test helper |
| 6 | `test_burn_insufficient_balance_still_panics` | `_burn` guard is active |
| 7 | `test_mint_then_burn_leaves_zero_balance_no_token_movement` | no TYC moves via helpers |
| 8 | `legacy_mint_registration_voucher_owner_succeeds` | owner can call legacy cross-contract path |
| 9 | `legacy_mint_registration_voucher_produces_redeemable_voucher` | produced voucher is redeemable |
| 10 | `legacy_mint_registration_voucher_non_owner_rejected` | non-owner is rejected (canary) |
| 11 | `deprecated_call_does_not_corrupt_subsequent_canonical_flow` | no state corruption |
| 12 | `test_mint_voucher_has_no_value_entry_redeem_panics` | documents semantic gap |

## Test patterns

### Shared fixture

```rust
let f = Fixture::new();      // fresh isolated Soroban env + all contracts deployed
f.reward.mint_voucher(…);
f.game.register_player(…);
f.boost_system.admin_grant_boost(…);
```

### Testing panics

```rust
let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
    f.reward.some_deprecated_fn(…);
}));
assert!(res.is_err(), "must panic");
```

### Checking balances

```rust
f.tyc_balance(&f.reward_id)   // i128 TYC balance of any address
f.reward.get_balance(&addr, &tid)  // voucher balance (0 or 1)
```

## Security notes

- No new privileged patterns are introduced — all tests go through `mock_all_auths()`.
- Admin-only entrypoints (`admin_*`) are separately covered in `admin_access_control_tests.rs` inside each contract crate.
- `test_mint` / `test_burn` are documented as unguarded canaries pending a hardening follow-up.

## References

- Stellar Wave: SW-CON-002, SW-CON-003, SW-CON-004, SW-CON-005
- Soroban SDK: <https://docs.rs/soroban-sdk>
- [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)
