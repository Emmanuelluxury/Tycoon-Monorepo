# Security Review Checklist — tycoon-collectibles (SW-CT-019)

**Issue:** SW-CT-019
**Contract:** `contract/contracts/tycoon-collectibles/src/lib.rs`
**SDK:** soroban-sdk (workspace version)
**Review basis:** source code inspection of `src/lib.rs`, `src/storage.rs`,
`src/transfer.rs`, `src/enumeration.rs`, `src/errors.rs`, `src/events.rs`,
`src/types.rs`, and `contract/contracts/tycoon-lib/src/fees.rs`.

Legend: ✅ Pass · ⚠️ Note / minor concern · ❌ Fail / blocking

---

## 1. Authorization & Access Control

### Admin Functions

| # | Entrypoint | Status | Notes |
|---|---|---|---|
| AC-1 | `initialize` | ✅ | One-time setup via `has_admin` guard; returns `AlreadyInitialized` on re-call. No auth required by design (bootstrap). |
| AC-2 | `migrate` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-3 | `set_pause` | ✅ | `get_admin` + `admin.require_auth()`. Unified pause/unpause via boolean arg. |
| AC-4 | `init_shop` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-5 | `set_fee_config` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-6 | `stock_shop` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-7 | `restock_collectible` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-8 | `update_collectible_prices` | ✅ | `get_admin` + `admin.require_auth()`. |
| AC-9 | `set_backend_minter` | ✅ | `get_admin` + `admin.require_auth()`. Also rejects contract's own address. |
| AC-10 | `set_base_uri` | ✅ | `get_admin` + `admin.require_auth()`. Blocked if metadata is frozen. |
| AC-11 | `set_token_metadata` | ✅ | `get_admin` + `admin.require_auth()`. Blocked if metadata is frozen. |
| AC-12 | `clear_backend_minter` | ⚠️ | **Not implemented.** The checklist lists this function but no corresponding entrypoint exists in `src/lib.rs`. To revoke the minter role, admin must call `set_backend_minter` with a new address. Consider adding a `clear_backend_minter` entrypoint. |

### User / Caller-Authenticated Functions

| # | Entrypoint | Status | Notes |
|---|---|---|---|
| AC-13 | `buy_collectible_from_shop` | ✅ | `buyer.require_auth()`. Shop config and stock checked before payment. |
| AC-14 | `buy_collectible` | ⚠️ | `buyer.require_auth()` only. **No payment or price check** — any authenticated address can mint any `token_id` for free. This is intentional for backend-reward flows but should be explicitly documented. If unrestricted minting is undesirable, this entrypoint should require admin/minter auth. |
| AC-15 | `transfer` | ✅ | `from.require_auth()`. |
| AC-16 | `burn` | ✅ | `owner.require_auth()`. |
| AC-17 | `burn_collectible_for_perk` | ✅ | `caller.require_auth()`. Blocked when paused. Validates perk is not `None`. |
| AC-18 | `backend_mint` | ✅ | `caller.require_auth()` + `caller == admin || caller == minter`. |
| AC-19 | `mint_collectible` | ✅ | `caller.require_auth()` + `caller == admin || caller == minter`. |

### Read-Only Functions (no auth required)

`balance_of`, `tokens_of`, `get_backend_minter`, `get_stock`,
`is_contract_paused`, `get_token_perk`, `get_token_strength`,
`owned_token_count`, `token_of_owner_by_index`, `tokens_of_owner_page`,
`iterate_owned_tokens`, `max_page_size`, `base_uri_config`,
`token_metadata`, `token_uri`, `is_metadata_frozen` — all ✅ (no state mutation).

---

## 2. Input Validation

| # | Check | Status | Notes |
|---|---|---|---|
| IV-1 | `amount == 0` guard in `stock_shop` | ✅ | Returns `InvalidAmount`. |
| IV-2 | `additional_amount == 0` guard in `restock_collectible` | ✅ | Returns `InvalidAmount`. |
| IV-3 | Perk range check (0–11) in `stock_shop` | ✅ | `perk > 11` → `InvalidPerk`. `perk == 0` (`Perk::None`) is allowed as a shop item. |
| IV-4 | Perk range check (1–11) in `mint_collectible` | ✅ | `perk == 0 || perk > 11` → `InvalidPerk`. `Perk::None` rejected for minted rewards. |
| IV-5 | Strength range (1–5) for CashTiered/TaxRefund | ✅ | Both `stock_shop` and `mint_collectible` check `!(1..=5).contains(&strength)`. |
| IV-6 | Token existence before price/stock operations | ✅ | `get_collectible_price` returns `None` → `TokenNotFound`. |
| IV-7 | Fee basis points total ≤ 10000 | ⚠️ | **No validation in `set_fee_config`.** Caller can set `platform_fee_bps + creator_fee_bps + pool_fee_bps > 10000`, causing `calculate_fee_split` to distribute more than the full price. `calculate_fee_split` uses `saturating_sub` for residue, so no underflow, but buyers would be charged more than `price`. Add a sum-≤-10000 guard in `set_fee_config`. |
| IV-8 | Page size limit in enumeration | ✅ | `MAX_PAGE_SIZE` constant enforced in `tokens_of_owner_page` and `iterate_owned_tokens`. |
| IV-9 | `set_backend_minter` rejects contract's own address | ✅ | Explicit check; returns `Unauthorized`. |

---

## 3. Reentrancy Protection (CEI Pattern)

| # | Function | Status | Notes |
|---|---|---|---|
| CEI-1 | `buy_collectible_from_shop` | ✅ | Explicit CEI sections in comments. Stock decremented and collectible minted before any token transfer. |
| CEI-2 | `burn_collectible_for_perk` | ✅ | `_safe_burn` called before `emit_collectible_burned_event`. No external calls. |
| CEI-3 | `transfer` | ✅ | Delegates to `_safe_transfer`; no external calls. |
| CEI-4 | `burn` | ✅ | Delegates to `_safe_burn`; no external calls. |
| CEI-5 | External calls limited to trusted tokens | ✅ | `tyc_token` and `usdc_token` are admin-set; no untrusted external contract calls. |

---

## 4. Arithmetic Safety

| # | Check | Status | Notes |
|---|---|---|---|
| AR-1 | Balance overflow in `_safe_mint` | ✅ | Uses `checked_add`; returns `Overflow` error. |
| AR-2 | Underflow in `_safe_burn` | ✅ | Checks `balance < amount` before subtraction. |
| AR-3 | Token ID generation overflow | ✅ | `u128` range; `increment_token_id` uses `checked_add` (tycoon-lib). |
| AR-4 | Fee calculation overflow | ✅ | `calculate_fee_split` uses `u128` multiplication; `saturating_sub` for residue prevents underflow. |
| AR-5 | `tyc_price` / `usdc_price` cast to `i128` | ⚠️ | `stock_shop` and `buy_collectible_from_shop` cast `u128` prices to `i128`. Values above `i128::MAX` would wrap. In practice prices are expected to be well within range, but an explicit bounds check (`assert!(price <= i128::MAX as u128)`) would be safer. |

---

## 5. Pause Mechanism

| # | Check | Status | Notes |
|---|---|---|---|
| PAUSE-1 | `burn_collectible_for_perk` checks `is_paused` | ✅ | Returns `ContractPaused`. |
| PAUSE-2 | Only admin can pause/unpause via `set_pause` | ✅ | |
| PAUSE-3 | `buy_collectible_from_shop` does **not** check pause | ℹ️ | Intentional — shop purchases remain available during pause so inventory operations are unaffected. |
| PAUSE-4 | `transfer` and `burn` do **not** check pause | ℹ️ | Intentional — only perk activation is blocked during emergencies. |

---

## 6. Storage & State Consistency

| # | Check | Status | Notes |
|---|---|---|---|
| ST-1 | Admin stored in instance storage; minter in instance storage | ✅ | |
| ST-2 | Shop stock decremented before mint in `buy_collectible_from_shop` | ✅ | Prevents double-spend if token transfer reverts. |
| ST-3 | Metadata frozen flag is one-way | ✅ | `set_base_uri` and `set_token_metadata` both reject when frozen. |
| ST-4 | `OwnedTokens` list updated on mint/burn | ✅ | Enumeration module maintains `OWNED_*` and `TIDX_*` storage keys. |
| ST-5 | Token IDs generated internally; user cannot choose IDs in minting flows | ✅ | `increment_token_id` and `get_next_collectible_id` are internal. |

---

## 7. Event Emission

| # | Function | Event | Status |
|---|---|---|---|
| EV-1 | `stock_shop` | `CollectibleStocked` | ✅ |
| EV-2 | `restock_collectible` | `CollectibleRestocked` | ✅ |
| EV-3 | `update_collectible_prices` | `PriceUpdated` | ✅ |
| EV-4 | `buy_collectible_from_shop` | `CollectibleBought`, `FeeDistributed` | ✅ |
| EV-5 | `burn_collectible_for_perk` | `CashPerkActivated` or `PerkActivated`, `CollectibleBurned` | ✅ |
| EV-6 | `mint_collectible` | `CollectibleMinted` | ✅ |
| EV-7 | `set_backend_minter` | `minter/set` | ✅ |

---

## 8. Denial-of-Service / Gas

| # | Check | Status | Notes |
|---|---|---|---|
| DOS-1 | No unbounded loops in public entrypoints | ✅ | |
| DOS-2 | Pagination enforced via `MAX_PAGE_SIZE` | ✅ | `tokens_of_owner_page` and `iterate_owned_tokens` cap results. |
| DOS-3 | `burn_collectible_for_perk` is O(1) per call | ✅ | |

---

## 9. Oracle & External Dependencies

| # | Check | Status |
|---|---|---|
| ORA-1 | Prices set by admin (no external price feed) | ✅ |
| ORA-2 | No untrusted contract calls | ✅ |
| ORA-3 | Token addresses set by admin; no dynamic resolution | ✅ |

---

## 10. Testing Coverage

| # | Area | Status | Notes |
|---|---|---|---|
| TC-1 | Admin auth rejection tests | ✅ | `src/entrypoint_auth_tests.rs` covers all admin entrypoints. |
| TC-2 | Shop purchase flows | ✅ | `src/test.rs` and `integration-tests/tests/collectibles_integration.rs`. |
| TC-3 | Perk activation | ✅ | `src/coverage_tests.rs`. |
| TC-4 | Pause scenarios | ✅ | `src/coverage_tests.rs`. |
| TC-5 | Fee distribution | ✅ | `src/test.rs`. |
| TC-6 | Enumeration / pagination | ✅ | `src/coverage_tests.rs`. |
| TC-7 | Fee basis points > 10000 scenario | ⚠️ | No test for over-limit fee config. Should be added alongside the IV-7 guard. |
| TC-8 | `buy_collectible` without payment | ⚠️ | No test verifying or documenting the intentional no-payment behavior of `buy_collectible`. |

---

## 11. Open Items (Resolve Before Mainnet)

| ID | Severity | Description | Status |
|---|---|---|---|
| OI-1 | Medium | `clear_backend_minter` not implemented; no way to fully revoke minter role. | 🔲 Open |
| OI-2 | Medium | `set_fee_config` does not validate that total fee bps ≤ 10000. | 🔲 Open |
| OI-3 | Low | `buy_collectible` allows free minting by any authenticated address — access intent should be documented or restricted. | 🔲 Open |
| OI-4 | Low | `u128 → i128` price cast in `stock_shop` / `buy_collectible_from_shop` lacks explicit bounds check. | 🔲 Open |
| OI-5 | Info | External audit recommended before mainnet deployment. | 🔲 Pending budget |

---

## 12. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Smart Contract Dev | | | |
| Tech Lead | | | |
| Security Reviewer | | | |
| External Auditor | | | (pending) |
