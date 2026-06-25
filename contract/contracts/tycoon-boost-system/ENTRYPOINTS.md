# Entrypoints — tycoon-boost-system (SW-CT-030)

**Stellar Wave batch** | **Issue:** SW-CT-030 | **Status:** ✅ Verified

This document is the authoritative reference for every public function in the
`TycoonBoostSystem` Soroban contract. Functions are divided into two categories:

- **Admin-only** — require the stored admin `Address` to authorize the call.
- **Public** — callable by any address (usually the player) or require no auth at all.

---

## Admin-Only Entrypoints

These functions call `admin.require_auth()` or `require_admin()` and will panic
(`HostError`) if the admin does not sign the transaction.

| Function | Auth check | Description |
|----------|-----------|-------------|
| `initialize(admin: Address)` | `admin.require_auth()` | One-time setup; sets the admin. Panics `"AlreadyInitialized"` if called again. |
| `admin_grant_boost(player, boost)` | `get_admin() + require_auth()` | Admin grants a boost to any player without requiring the player's signature. |
| `admin_revoke_boost(player, boost_id)` | `get_admin() + require_auth()` | Admin removes a specific boost from a player. Idempotent (no-op if not found). |
| `add_boost(player, boost)` | `require_admin()` | Adds a boost for `player`; admin signs. Same validation as `admin_grant_boost`. |
| `clear_boosts(player)` | `require_admin()` | Removes all boosts for `player` and emits `BoostsClearedEvent`. |

### Admin Auth Flow

```
caller tx → admin_grant_boost(player, boost)
               │
               └─ get_admin(&env)       ← reads DataKey::Admin from instance storage
                      │
                      └─ admin.require_auth()   ← panics if admin signature absent
```

---

## Public (No-Auth / Player-Auth) Entrypoints

These functions are safe to call without an admin signature. They read state or
expose read-only views; they do not mutate privileged state.

| Function | Auth | Description |
|----------|------|-------------|
| `calculate_total_boost(player)` | None | Returns the net boost multiplier in basis points (10 000 = 100 %). Expired boosts are excluded inline without mutating storage. |
| `get_active_boosts(player)` | None | Returns only non-expired boosts for `player`. Preferred replacement for the deprecated `get_boosts`. |
| `admin()` | None | Returns the stored admin `Address`. |

### Deprecated Public Entrypoints

The following functions are deprecated and will be **removed in v1.0.0 (Q4 2026)**.
They emit a `DeprecatedFunctionCalledEvent` on every call.

| Function | Auth | Replacement |
|----------|------|-------------|
| `get_boosts(player)` | None | `get_active_boosts` |
| `prune_expired_boosts(player)` | None | Remove the call; auto-pruning handles it |

---

## Authorization Matrix

| Caller | `initialize` | `admin_grant_boost` | `admin_revoke_boost` | `add_boost` | `clear_boosts` | `calculate_total_boost` | `get_active_boosts` | `admin` |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Admin  | ✅ (first call only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Any other | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## Boundary Tests

Entrypoint boundaries are verified by `src/admin_access_control_tests.rs` (SW-CT-030):

| Test | Boundary verified |
|------|-----------------|
| `test_initialize_sets_admin` | `initialize` stores the admin address |
| `test_initialize_twice_panics` | `initialize` one-time guard |
| `test_admin_grant_boost_succeeds` | `admin_grant_boost` succeeds with auth |
| `test_admin_grant_boost_zero_value_panics` | `admin_grant_boost` input validation |
| `test_admin_grant_boost_past_expiry_panics` | `admin_grant_boost` expiry validation |
| `test_admin_grant_boost_duplicate_id_panics` | `admin_grant_boost` duplicate check |
| `test_admin_grant_boost_cap_exceeded_panics` | `admin_grant_boost` cap check |
| `test_admin_revoke_boost_removes_boost` | `admin_revoke_boost` removes correct entry |
| `test_admin_revoke_boost_nonexistent_is_noop` | `admin_revoke_boost` idempotent |
| `test_boundary_public_views_need_no_auth` | public views callable without auth |
| `test_boundary_admin_only_panics_without_init` | admin functions panic before init |
| `test_boundary_grant_revoke_isolation` | revoke on player A does not affect player B |

---

## Rollout Notes

- No new functions introduced — this document formalizes the existing boundary.
- No migration steps required.
- Feature flag: N/A (no feature-flag gating on auth).
- `cargo check` and `cargo test --package tycoon-boost-system` must pass before merge.
