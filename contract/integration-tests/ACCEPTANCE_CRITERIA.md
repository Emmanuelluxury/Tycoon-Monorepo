# Integration Tests — Acceptance Criteria

> **Stellar Wave**: SW-CON-002 · SW-CON-003 · SW-CON-004 · SW-CON-005

---

## SW-CON-002 — Workspace hygiene: admin-only vs public entrypoints

### Contract: `tycoon-reward-system`

| # | Criterion | Verification |
|---|-----------|-------------|
| 2.1 | Every formerly-unprefixed admin function (`migrate`, `pause`, `unpause`, `set_backend_minter`, `clear_backend_minter`, `withdraw_funds`) has an `admin_*` canonical counterpart | `grep "pub fn admin_" contracts/tycoon-reward-system/src/lib.rs` returns all six |
| 2.2 | Original names are retained as `#[deprecated]` shims that delegate to the `admin_*` function | `grep "#\[deprecated" contracts/tycoon-reward-system/src/lib.rs` lists each shim |
| 2.3 | Each `admin_*` function calls `require_admin(&e)` before touching state | Code review of `lib.rs` |
| 2.4 | Public entrypoints (`mint_voucher`, `redeem_voucher_from`, `transfer`, `get_balance`, `owned_token_count`, `get_backend_minter`) carry no admin check | Code review confirms absence of `admin.require_auth()` in those functions |
| 2.5 | `cargo check -p tycoon-reward-system` passes | CI green |
| 2.6 | Existing unit tests (`cargo test -p tycoon-reward-system`) continue to pass | CI green |

---

## SW-CON-003 — Integration-tests: simulation scenarios

### File: `integration-tests/src/simulation_scenarios.rs`

| # | Criterion | Test name |
|---|-----------|-----------|
| 3.1 | Admin withdraw reduces contract balance by the exact withdrawn amount | `admin_withdraw_funds_reduces_contract_balance` |
| 3.2 | `redeem_voucher_from` is rejected while paused and succeeds after unpause | `reward_redeem_blocked_when_paused` |
| 3.3 | Replacing backend minter atomically revokes the old minter | `backend_minter_replaced_old_minter_rejected` |
| 3.4 | `admin_grant_boost` is reflected by `get_boosts` and `get_effective_multiplier` | `boost_grant_and_query_cross_contract` |
| 3.5 | Three players' vouchers are independent: redeeming one does not affect others | `multi_player_independent_vouchers` |
| 3.6 | All 18 simulation scenarios pass without flakiness | `cargo test -p tycoon-integration-tests simulation_scenarios` |
| 3.7 | `cargo check -p tycoon-integration-tests` passes | CI green |

---

## SW-CON-004 — Integration-tests: documentation and acceptance criteria

| # | Criterion | Location |
|---|-----------|---------|
| 4.1 | `README.md` lists all simulation scenarios with descriptions | `integration-tests/README.md` scenario table |
| 4.2 | `README.md` lists all legacy-entrypoints tests | `integration-tests/README.md` scenario table |
| 4.3 | `README.md` includes run instructions for each test module | `integration-tests/README.md` "Running the tests" section |
| 4.4 | `ACCEPTANCE_CRITERIA.md` (this file) covers all four SW-CON issues | This document |
| 4.5 | PR body references Stellar Wave issue IDs (SW-CON-002 – SW-CON-005) | PR description |
| 4.6 | Each test function has a purpose comment explaining what it verifies | Code review |

---

## SW-CON-005 — Integration-tests: deprecation path for legacy entrypoints

### File: `integration-tests/src/legacy_entrypoints.rs`

| # | Criterion | Test name |
|---|-----------|-----------|
| 5.1 | `redeem_voucher` always panics | `legacy_redeem_voucher_always_panics` |
| 5.2 | `redeem_voucher` does not transfer any TYC | `legacy_redeem_voucher_does_not_transfer_tokens` |
| 5.3 | Canonical `redeem_voucher_from` is unaffected by a prior deprecated call | `canonical_redeem_voucher_from_still_works_after_legacy_attempt` |
| 5.4 | `test_mint` is documented as an unguarded canary | `test_mint_entrypoint_is_unguarded_canary` |
| 5.5 | `test_burn` is documented as an unguarded canary | `test_burn_entrypoint_is_unguarded_canary` |
| 5.6 | `test_burn` with zero balance panics (internal guard is active) | `test_burn_insufficient_balance_still_panics` |
| 5.7 | `test_mint` + `test_burn` leave zero balance and no TYC movement | `test_mint_then_burn_leaves_zero_balance_no_token_movement` |
| 5.8 | Owner can call `mint_registration_voucher` and voucher is minted | `legacy_mint_registration_voucher_owner_succeeds` |
| 5.9 | Voucher produced by `mint_registration_voucher` is redeemable | `legacy_mint_registration_voucher_produces_redeemable_voucher` |
| 5.10 | Deprecated call does not corrupt subsequent canonical flow | `deprecated_call_does_not_corrupt_subsequent_canonical_flow` |
| 5.11 | `test_mint` voucher has no `VoucherValue` entry; `redeem_voucher_from` panics | `test_mint_voucher_has_no_value_entry_redeem_panics` |
| 5.12 | `legacy_entrypoints` module is properly declared in `src/lib.rs` | `grep "mod legacy_entrypoints" integration-tests/src/lib.rs` |
| 5.13 | `cargo test -p tycoon-integration-tests legacy_entrypoints` passes | CI green |

---

## Cross-cutting acceptance criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| X.1 | `cargo check` passes for all workspace members | `cd contract && cargo check --all` |
| X.2 | All tests pass | `cd contract && cargo test --all` |
| X.3 | No new unaudited oracle or privileged pattern introduced | Code review; `grep -r "invoke_contract" contract/contracts/` shows no new occurrences |
| X.4 | All PR references include Stellar Wave issue IDs | PR description |
| X.5 | CI (GitHub Actions `contract-ci.yml`) is green | GitHub Actions check |

---

## Migration / rollout steps

### SW-CON-002 — Reward system entrypoint rename

The `admin_*` rename is purely additive on-chain:

1. **Testnet**: Deploy the updated `tycoon-reward-system` WASM. Both old names (shims) and new `admin_*` names are callable.
2. **Integrators** (backend, scripts) should migrate calls to `admin_*` variants during the deprecation window.
3. **Mainnet**: Deploy after testnet validation. The shim functions remain available until the next major upgrade.
4. **Removal**: In a future major version, remove all `#[deprecated]` shims and bump the WASM version tag.

### SW-CON-005 — Legacy entrypoints

- `redeem_voucher` is already hard-deprecated (always panics). No migration action needed.
- `test_mint` / `test_burn` are compile-time `#[deprecated]` in `#[cfg(test)]` only. They are not present in the production WASM.
- `mint_registration_voucher` remains functional; the typed-client migration is tracked as a follow-up item.
