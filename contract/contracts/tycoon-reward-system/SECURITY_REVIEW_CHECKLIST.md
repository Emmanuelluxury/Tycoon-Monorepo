# Security Review Checklist — tycoon-reward-system

**Issue:** SW-FE-001  
**Reviewer:** (assign before merge)  
**Date:** 2026-04-24  
**Contract:** `contract/contracts/tycoon-reward-system/src/lib.rs`  
**SDK:** soroban-sdk 23  

---

## 1. Access Control

| # | Check | Status | Notes |
|---|---|---|---|
| AC-1 | `initialize` can only be called once | ✅ | Guards on `DataKey::Admin` presence |
| AC-2 | `pause` / `unpause` require admin `require_auth()` | ✅ | |
| AC-3 | `set_backend_minter` / `clear_backend_minter` require admin | ✅ | |
| AC-4 | `mint_voucher` restricted to admin or backend minter | ✅ | Both paths call `caller.require_auth()` |
| AC-5 | `withdraw_funds` restricted to admin | ✅ | |
| AC-6 | `redeem_voucher_from` restricted to voucher owner (`redeemer.require_auth()`) | ✅ | |
| AC-7 | `transfer` restricted to sender (`from.require_auth()`) | ✅ | |
| AC-8 | No unaudited oracle or privileged pattern without review | ✅ | No oracle used; backend minter is the only privileged pattern and is admin-controlled |
| AC-9 | `test_mint` / `test_burn` are test-only helpers | ✅ | Gated by `#[cfg(test)]` on the `impl` block — excluded from the release WASM. |

---

## 2. CEI (Checks-Effects-Interactions) Pattern

| # | Function | Checks before effects? | Effects before interactions? | Status |
|---|---|---|---|---|
| CEI-1 | `redeem_voucher_from` | ✅ reads `tyc_value`, `tyc_token` | ✅ `_burn` + `remove(VoucherValue)` before `token.transfer` | ✅ |
| CEI-2 | `withdraw_funds` | ✅ reads balance | ✅ no state mutation after transfer | ✅ |
| CEI-3 | `mint_voucher` | ✅ auth check first | ✅ all storage writes before event | ✅ |
| CEI-4 | `transfer` | ✅ pause check | ✅ `_burn` then `_mint` before event | ✅ |

---

## 3. Integer Arithmetic

| # | Check | Status | Notes |
|---|---|---|---|
| INT-1 | `_mint` uses `checked_add` for balance | ✅ | Panics on overflow |
| INT-2 | `_burn` checks `current_balance < amount` before subtraction | ✅ | |
| INT-3 | `VoucherCount` increment uses `checked_add` | ✅ | Fixed — uses `checked_add(1).expect("VoucherCount overflow")` |
| INT-4 | `OwnedTokenCount` decrement is guarded (`if current_count > 0`) | ✅ | |
| INT-5 | `amount as i128` cast in `withdraw_funds` guarded by explicit bounds check | ✅ | Fixed — panics with `"amount exceeds i128::MAX"` if `amount > i128::MAX as u128` |

---

## 4. Pause Mechanism

| # | Check | Status |
|---|---|---|
| PAUSE-1 | `redeem_voucher_from` checks `Paused` flag | ✅ |
| PAUSE-2 | `transfer` checks `Paused` flag | ✅ |
| PAUSE-3 | `mint_voucher` does **not** check `Paused` | ℹ️ Intentional — minting should remain available during pause so rewards can still be issued |
| PAUSE-4 | `withdraw_funds` does **not** check `Paused` | ℹ️ Intentional — admin must be able to recover funds during emergency |

---

## 5. Storage & State Consistency

| # | Check | Status | Notes |
|---|---|---|---|
| ST-1 | `VoucherValue` deleted before external call in `redeem_voucher_from` | ✅ | Prevents double-spend |
| ST-2 | `OwnedTokenCount` incremented on first mint, decremented on last burn | ✅ | |
| ST-3 | `VoucherCount` monotonically increases; no reuse of token IDs | ✅ | |
| ST-4 | `BackendMinter` can be cleared by admin | ✅ | |
| ST-5 | No storage key collision between `Balance(addr, id)` and other keys | ✅ | Enum variants are distinct |

---

## 6. Event Emission

| # | Function | Event | Status |
|---|---|---|---|
| EV-1 | `pause` | `Paused` | ✅ |
| EV-2 | `unpause` | `Unpaused` | ✅ |
| EV-3 | `set_backend_minter` | `set_min` | ✅ |
| EV-4 | `clear_backend_minter` | `clr_min` | ✅ |
| EV-5 | `mint_voucher` | `V_Mint` | ✅ |
| EV-6 | `redeem_voucher_from` | `Redeem` | ✅ |
| EV-7 | `withdraw_funds` | `Withdraw` | ✅ |
| EV-8 | `transfer` | `Transfer` | ✅ |
| EV-9 | `_mint` (internal) | `Mint` | ✅ |
| EV-10 | `_burn` (internal) | `Burn` | ✅ |

---

## 7. Denial-of-Service / Gas

| # | Check | Status | Notes |
|---|---|---|---|
| DOS-1 | No unbounded loops in any public function | ✅ | |
| DOS-2 | No dynamic storage reads proportional to user count | ✅ | |
| DOS-3 | `redeem_voucher_from` single external call | ✅ | |

---

## 8. Stellar / Soroban Best Practices

| # | Check | Status | Notes |
|---|---|---|---|
| SBP-1 | Uses `soroban_sdk::token::Client` for token transfers | ✅ | |
| SBP-2 | Uses `e.current_contract_address()` (not hardcoded) | ✅ | |
| SBP-3 | `#[contracttype]` on `DataKey` | ✅ | |
| SBP-4 | `overflow-checks = true` in release profile | ✅ | Workspace `Cargo.toml` |
| SBP-5 | `panic = "abort"` in release profile | ✅ | |
| SBP-6 | No `unsafe` blocks | ✅ | |
| SBP-7 | `#[no_std]` | ✅ | |
| SBP-8 | `lto = true`, `codegen-units = 1` for WASM size | ✅ | |

---

## 9. Open Items (Must Resolve Before Mainnet)

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| OI-1 | Medium | `test_mint` / `test_burn` are callable on-chain — remove or restrict | SW-CT-013 | ✅ Resolved — gated by `#[cfg(test)]` on the impl block |
| OI-2 | Low | `VoucherCount += 1` should use `checked_add` | SW-CT-013 | ✅ Resolved — uses `checked_add(1).expect("VoucherCount overflow")` |
| OI-3 | Low | `amount as i128` cast should be bounds-checked | SW-CT-013 | ✅ Resolved — explicit `amount > i128::MAX as u128` guard added |
| OI-4 | Info | External audit recommended before mainnet (see `CEI_SECURITY_AUDIT.md §6`) | | 🔲 Pending budget |

---

## 10. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Smart Contract Dev | | | |
| Tech Lead | | | |
| Security Reviewer | | | |
| External Auditor | | | (pending) |
