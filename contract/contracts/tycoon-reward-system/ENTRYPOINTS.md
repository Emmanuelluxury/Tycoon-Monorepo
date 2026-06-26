# Entrypoint Classification — tycoon-reward-system (SW-CT-016 / SW-CT-018)

All public entrypoints of the `TycoonRewardSystem` contract, classified by
authorization requirement. Derived directly from `src/lib.rs`.

---

## Admin-Only Entrypoints

These entrypoints read the admin address from `DataKey::Admin` in persistent
storage and call `admin.require_auth()`. Any caller whose signature does not
match the stored admin address is rejected by the Soroban auth framework.

| Entrypoint | Signature | Notes |
|---|---|---|
| `initialize` | `(admin: Address, tyc_token: Address, usdc_token: Address)` | One-time setup. Auth is on the caller-supplied `admin` address. Panics `"Already initialized"` on re-call. |
| `migrate` | `()` | Bumps state version from 0 → 1. Idempotent at v1. |
| `pause` | `()` | Sets `Paused = true`; emits `Paused` event. |
| `unpause` | `()` | Sets `Paused = false`; emits `Unpaused` event. |
| `set_backend_minter` | `(new_minter: Address)` | Grants the backend-minter role to `new_minter`. |
| `clear_backend_minter` | `()` | Revokes the backend-minter role. |
| `withdraw_funds` | `(token: Address, to: Address, amount: u128)` | Transfers `token` from the contract to `to`. `token` must be the registered TYC or USDC address. |

---

## Dual-Role Entrypoints (Admin or Backend Minter)

These entrypoints call `caller.require_auth()` and then verify that
`caller == admin || caller == backend_minter`. Both roles are checked against
storage at call time.

| Entrypoint | Signature | Notes |
|---|---|---|
| `mint_voucher` | `(caller: Address, to: Address, tyc_value: u128) -> u128` | Mints a voucher redeemable for `tyc_value` TYC. Voucher IDs start at `VOUCHER_ID_START = 1_000_000_000`. Returns the new token ID. |

---

## Caller-Authenticated Entrypoints

The caller provides a signature for their own address. Any authenticated
address may call these.

| Entrypoint | Signature | Auth | Notes |
|---|---|---|---|
| `redeem_voucher_from` | `(redeemer: Address, token_id: u128)` | `redeemer.require_auth()` | Burns the voucher and transfers its TYC value to `redeemer`. Blocked when paused. |
| `transfer` | `(from: Address, to: Address, token_id: u128, amount: u64)` | `from.require_auth()` | Transfers voucher units from `from` to `to`. Blocked when paused. |

---

## Deprecated Entrypoints

| Entrypoint | Signature | Replacement | Behavior |
|---|---|---|---|
| `redeem_voucher` | `(token_id: u128)` | `redeem_voucher_from` | Always panics: `"Use redeem_voucher_from instead"`. Retained as a helpful stub. |

See [`DEPRECATION.md`](./DEPRECATION.md) for the migration guide.

---

## Public Read-Only Entrypoints

No authorization required. Safe to call from any context.

| Entrypoint | Signature | Returns |
|---|---|---|
| `get_backend_minter` | `()` | `Option<Address>` — `None` if not set |
| `get_balance` | `(owner: Address, token_id: u128)` | `u64` |
| `owned_token_count` | `(owner: Address)` | `u32` — count of distinct token IDs held |

---

## Test-Only Helpers

These are compiled only under `#[cfg(test)]` and are not available on a
deployed contract. They expose `_mint` and `_burn` directly for unit tests.

| Helper | Notes |
|---|---|
| `test_mint(to, token_id, amount)` | Calls `_mint` directly |
| `test_burn(from, token_id, amount)` | Calls `_burn` directly |

---

## Authorization Test Coverage

| Entrypoint | Covering test(s) |
|---|---|
| `initialize` | `test_initialize_once_only` |
| `pause` / `unpause` | `test_pause_requires_admin_auth`, `test_unpause_requires_admin_auth`, `test_only_admin_can_pause` |
| `set_backend_minter` | `test_set_backend_minter_reads_admin_from_storage`, `test_set_backend_minter_no_auth_fails` |
| `clear_backend_minter` | `test_clear_backend_minter_reads_admin_from_storage`, `test_clear_backend_minter` |
| `withdraw_funds` | `test_withdraw_funds_admin_succeeds`, `test_withdraw_funds_non_admin_reverts`, `test_withdraw_funds_insufficient_balance_reverts`, `test_withdraw_funds_invalid_token_reverts` |
| `mint_voucher` | `test_mint_voucher_admin_succeeds`, `test_mint_voucher_backend_minter_succeeds`, `test_mint_voucher_unauthorized_panics`, `test_non_admin_non_minter_cannot_mint` |
| `redeem_voucher_from` | `test_redeem_voucher_from_user_succeeds`, `test_redeem_voucher_from_blocked_when_paused`, `test_double_redeem_prevented`, `test_redeem_blocked_when_paused` |
| `transfer` | `test_transfer_user_succeeds`, `test_transfer_blocked_when_paused` |
| `redeem_voucher` (deprecated) | `test_redeem_voucher_deprecated_always_panics`, `test_redeem_voucher_deprecated_panics` |
| `migrate` | `test_migrate_is_idempotent_at_version_1` |
