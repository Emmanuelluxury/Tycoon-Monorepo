# PR Notes — Stellar Wave Contract Batch SW-CON-002 to SW-CON-005

## Summary

This PR delivers four Stellar Wave contract engineering items:

| Issue | Scope | Key change |
|-------|-------|-----------|
| SW-CON-002 | `tycoon-reward-system` | Formalize admin-only vs public entrypoints |
| SW-CON-003 | `integration-tests` | Add 6 new simulation scenarios |
| SW-CON-004 | `integration-tests` | Update README and ACCEPTANCE_CRITERIA |
| SW-CON-005 | `integration-tests` | Wire `legacy_entrypoints` module; complete deprecation coverage |

---

## SW-CON-002 — Workspace hygiene: admin-only vs public entrypoints

**File changed**: `contract/contracts/tycoon-reward-system/src/lib.rs`

### What changed

Added a private `require_admin` helper and renamed the six admin-only entrypoints to use the `admin_` prefix:

| Old name | New canonical name |
|----------|--------------------|
| `migrate` | `admin_migrate` |
| `pause` | `admin_pause` |
| `unpause` | `admin_unpause` |
| `set_backend_minter` | `admin_set_backend_minter` |
| `clear_backend_minter` | `admin_clear_backend_minter` |
| `withdraw_funds` | `admin_withdraw_funds` |

The old names are retained as `#[deprecated(since = "0.2.0")]` shims that delegate to the `admin_*` function, preserving backward compatibility for existing integrations.

Public entrypoints (`mint_voucher`, `redeem_voucher_from`, `transfer`, `get_balance`, `owned_token_count`, `get_backend_minter`) are unchanged and carry no admin check.

`redeem_voucher` retains its `#[deprecated(since = "0.1.0")]` hard-panic status.

### Migration

Integrators should migrate to `admin_*` names during the deprecation window. The shims will be removed in the next major contract upgrade.

---

## SW-CON-003 — Integration-tests: simulation scenarios

**File changed**: `contract/integration-tests/src/simulation_scenarios.rs`

### What changed

Added 6 new scenarios (scenarios 13–18) to the existing 12:

- **13** `admin_withdraw_funds_reduces_contract_balance` — exact balance accounting
- **14** `reward_redeem_blocked_when_paused` — pause/unpause redemption gate
- **15** `backend_minter_replaced_old_minter_rejected` — atomic minter replacement
- **16** `boost_grant_and_query_cross_contract` — boost system cross-contract flow
- **17** `multi_player_independent_vouchers` — no cross-contamination between players
- **18** `admin_only_entrypoints_require_auth` — canary + documentation

The module docstring is updated to list all 18 scenarios.

---

## SW-CON-004 — Integration-tests: documentation and acceptance criteria

**Files changed**:
- `contract/integration-tests/README.md` — rewritten; full scenario tables, run instructions, security notes
- `contract/integration-tests/ACCEPTANCE_CRITERIA.md` — rewritten; per-issue criteria with test name cross-references and migration steps

---

## SW-CON-005 — Integration-tests: deprecation path for legacy entrypoints

**File changed**: `contract/integration-tests/src/lib.rs`

### What changed

`legacy_entrypoints` was authored but never wired into `lib.rs`. Added:

```rust
#[cfg(test)]
mod legacy_entrypoints;
```

This makes all 12 tests in `legacy_entrypoints.rs` visible to `cargo test` and CI.

---

## Rollout / feature flag / migration

- All changes are backward-compatible. No new on-chain state keys or storage layout changes.
- The `admin_*` rename in `tycoon-reward-system` is purely additive; existing callers using the old names still compile and work via shims.
- The `legacy_entrypoints` module is `#[cfg(test)]` only — zero production WASM impact.
- No oracle or new privileged pattern introduced.

## CI checklist

- [ ] `cargo check --all` passes
- [ ] `cargo test --all` passes
- [ ] PR references SW-CON-002, SW-CON-003, SW-CON-004, SW-CON-005
