# Acceptance Criteria — tycoon-boost-system (SW-CT-028)

**Stellar Wave batch** | **Issue:** SW-CT-028 | **Status:** ✅ Verified

---

## Initialization

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-INIT-01 | `initialize(admin)` sets the admin address in instance storage | `test_initialize_twice_panics` — second call panics, proving first set |
| AC-INIT-02 | Calling `initialize` a second time panics with `"AlreadyInitialized"` | `test_initialize_twice_panics` |
| AC-INIT-03 | `admin()` returns the address supplied to `initialize` | `admin_access_control_tests.rs` — `test_admin_getter` |
| AC-INIT-04 | Admin must authorize `initialize` (signature required) | `soroban_sdk::Address::require_auth()` in `initialize` |

---

## Boost Addition — Public (`add_boost`)

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-ADD-01 | `add_boost` succeeds when all fields are valid | `test_additive_stacking` |
| AC-ADD-02 | `add_boost` panics `"NotInitialized"` before `initialize` | `test_add_boost_without_initialize_panics` |
| AC-ADD-03 | `add_boost` panics `"InvalidValue"` when `boost.value == 0` | `test_zero_value_boost_rejected` |
| AC-ADD-04 | `add_boost` panics `"InvalidExpiry"` when expiry ≤ current ledger | `test_expired_boost_rejected_at_add` |
| AC-ADD-05 | `add_boost` panics `"CapExceeded"` when player already holds 10 boosts | `test_cap_exceeded` |
| AC-ADD-06 | `add_boost` panics `"DuplicateId"` when same `id` is already active | `test_duplicate_id_rejected` |
| AC-ADD-07 | `add_boost` auto-prunes expired boosts before cap check | `test_cap_freed_by_expiry_allows_new_boost` (simulation_scenarios) |
| AC-ADD-08 | `add_boost` emits `BoostActivatedEvent` on success | `test_boost_activated_event_emitted` |
| AC-ADD-09 | Admin authorization is required (non-admin call rejected) | `test_add_boost_requires_admin_auth` |

---

## Boost Stacking Rules

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-SR-01 | Additive boosts sum their basis-point values before applying | `test_additive_stacking` — +10 % + +5 % = 11 500 bp |
| AC-SR-02 | Multiplicative boosts chain: each multiplies the running total | `test_multiplicative_stacking` — 1.5× × 1.2× = 18 000 bp |
| AC-SR-03 | Override: only the highest-priority value applies | `test_override_highest_priority` — priority 10 beats priority 5 |
| AC-SR-04 | Override supersedes all additive and multiplicative boosts | `test_override_ignores_others` |
| AC-SR-05 | Mixed additive + multiplicative: `mult_chain × (1 + add_sum)` | `test_mixed_stacking` — 1.5× + +10 % = 16 500 bp |
| AC-SR-06 | No active boosts → returns base 10 000 bp | `test_no_boosts` |
| AC-SR-07 | Same inputs always produce the same output (deterministic) | `test_deterministic_outcome` |

---

## Expiry Semantics

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-EXP-01 | `expires_at_ledger == 0` means boost never expires | `test_boost_never_expires_when_zero` |
| AC-EXP-02 | `expires_at_ledger > current_ledger` → boost is active | `test_boost_active_before_expiry` |
| AC-EXP-03 | `expires_at_ledger <= current_ledger` → boost is expired and excluded | `test_expired_boost_excluded_from_calculation` |
| AC-EXP-04 | `calculate_total_boost` filters expired boosts without mutating storage | `test_calculate_does_not_mutate_storage` |
| AC-EXP-05 | Ledger advance mid-session expires a boost at calculation time | `test_boost_expires_mid_session` (simulation_scenarios) |

---

## Cap Rules

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-CAP-01 | Player may hold at most 10 active boosts | `test_cap_exceeded` |
| AC-CAP-02 | Expired boosts are pruned before cap check, freeing slots | `test_cap_freed_by_expiry_allows_new_boost` |
| AC-CAP-03 | Duplicate boost ID for same player is rejected | `test_duplicate_id_rejected` |

---

## Admin-Only Operations

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-ADM-01 | `admin_grant_boost` grants a boost without requiring player auth | `test_admin_grant_boost_basic` |
| AC-ADM-02 | `admin_grant_boost` applies the same validation as `add_boost` | `test_admin_grant_boost_invalid_value`, `test_admin_grant_boost_invalid_expiry` |
| AC-ADM-03 | `admin_grant_boost` panics without admin auth | `test_admin_grant_boost_rejects_without_auth` (security_review_tests) |
| AC-ADM-04 | `admin_revoke_boost` removes a boost by ID | `test_admin_revoke_boost_removes_boost` |
| AC-ADM-05 | `admin_revoke_boost` is idempotent (silent on missing ID) | `test_admin_revoke_boost_idempotent` |
| AC-ADM-06 | `admin_revoke_boost` panics without admin auth | `test_admin_revoke_boost_rejects_without_auth` (security_review_tests) |
| AC-ADM-07 | `clear_boosts` removes all boosts and emits `BoostsClearedEvent` | `test_clear_boosts` |
| AC-ADM-08 | `clear_boosts` requires admin authorization | `test_clear_boosts_without_initialize_panics` |

---

## Read-Only Views

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-VIEW-01 | `get_active_boosts` returns only non-expired boosts | `test_get_active_boosts_filters_expired` |
| AC-VIEW-02 | `get_active_boosts` requires no auth | public read-only, no `require_auth` call |
| AC-VIEW-03 | `calculate_total_boost` requires no auth | public read-only |
| AC-VIEW-04 | `admin()` returns the stored admin address | `test_admin_getter` |

---

## Deprecated Functions

| ID | Criterion | Verified by |
|----|-----------|-------------|
| AC-DEP-01 | `get_boosts` emits `DeprecatedFunctionCalledEvent` | `deprecation_tests.rs` |
| AC-DEP-02 | `prune_expired_boosts` emits `DeprecatedFunctionCalledEvent` | `deprecation_tests.rs` |
| AC-DEP-03 | Deprecated functions remain callable (no breaking removal yet) | `deprecation_tests.rs` backward-compat tests |

---

## PR / CI Criteria

| ID | Criterion |
|----|-----------|
| AC-CI-01 | PR title references `SW-CT-028` |
| AC-CI-02 | `cargo check --workspace` passes with zero errors |
| AC-CI-03 | `cargo test --package tycoon-boost-system` passes all tests |
| AC-CI-04 | No unaudited oracle or privileged pattern introduced |
| AC-CI-05 | No `unsafe` code added |
