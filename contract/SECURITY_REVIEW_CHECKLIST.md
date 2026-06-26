# Workspace Security Review Checklist — Soroban Contracts (SW-CT-031)

**Stellar Wave batch** | **Issues:** SW-CONTRACT-HYGIENE-001, SW-CT-031 | **Status:** ✅ Updated June 25, 2026

This document is the single authoritative workspace-level security checklist for all
contracts under `contract/contracts/`. Per-contract checklists live alongside each
crate and are linked below.

---

## 1. Per-Contract Checklist Status

| Contract | Checklist | Status |
|---|---|---|
| tycoon-token | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-token/SECURITY_REVIEW_CHECKLIST.md) | ✅ Complete |
| tycoon-collectibles | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-collectibles/SECURITY_REVIEW_CHECKLIST.md) | ⚠️ Items unchecked — pre-mainnet |
| tycoon-boost-system | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-boost-system/SECURITY_REVIEW_CHECKLIST.md) | ✅ Complete (1 open medium) |
| tycoon-reward-system | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-reward-system/SECURITY_REVIEW_CHECKLIST.md) | ✅ Checklist present (SW-CT-037) |
| tycoon-game | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-game/SECURITY_REVIEW_CHECKLIST.md) | ✅ Checklist present (SW-CT-037) |
| tycoon-lib | No public entrypoints | ✅ Library only — no auth surface |

---

## 2. Workspace-Wide Security Properties

### 2.1 No Unaudited Oracle or Privileged Pattern in Production

- [x] No contract reads an external price feed or oracle
- [x] All privileged roles (admin, backend minter, game controller) are set at `initialize` time and require `require_auth()` on every mutation
- [x] No contract grants itself elevated privileges via `env.current_contract_address()` as an auth principal
- [ ] **OPEN:** `tycoon-game::admin_mint_registration_voucher` has no idempotency guard — tracked as BLK-002 in `CEI_SECURITY_AUDIT.md`
- [ ] **OPEN:** `tycoon-collectibles::buy_collectible` allows free unlimited minting — tracked as BLK-001 in `CEI_SECURITY_AUDIT.md`

### 2.2 CEI (Checks-Effects-Interactions) Compliance

All cross-contract calls audited in `CEI_SECURITY_AUDIT.md`. Summary:

| Contract | Function | CEI Status |
|---|---|---|
| tycoon-reward-system | `redeem_voucher_from` | ✅ Fixed |
| tycoon-collectibles | `buy_collectible_from_shop` | ✅ Fixed |
| tycoon-main-game | `leave_pending_game` | ✅ Fixed |
| tycoon-game | `withdraw_funds` | ✅ Safe (no post-call mutation) |
| tycoon-collectibles | `buy_collectible` | 🔴 Blocker — free mint, no payment |

### 2.3 Integer Arithmetic

- [x] All token balance mutations use `checked_add` / `checked_sub` with explicit panic messages
- [x] `tycoon-token`: `mint` uses `checked_add` on balance and total supply
- [x] `tycoon-token`: `burn` / `burn_from` use `checked_sub` on total supply
- [x] `tycoon-reward-system`: `_mint` uses `checked_add`; `_burn` uses explicit `>=` guard before subtraction
- [x] `tycoon-boost-system`: stacking arithmetic uses `u64` intermediates to avoid `u32` overflow
- [x] Cargo workspace profile sets `overflow-checks = true` for release builds

### 2.4 Access Control Patterns

- [x] Every admin-only entrypoint calls `require_auth()` on the stored admin address before any state mutation
- [x] `initialize` functions are one-time guarded (panic on re-call)
- [x] No function grants a caller elevated privileges based on caller-supplied input alone
- [x] Backend minter / game controller roles are scoped — they cannot pause, withdraw, or set admin

### 2.5 Event Auditability

- [x] All state-changing operations emit at least one event
- [x] Admin role changes emit events with old + new addresses (tycoon-token `SetAdminEvent`)
- [x] Pause / unpause emit events
- [x] Deprecated function calls emit `DeprecatedFunctionCalledEvent` (tycoon-boost-system)
- [x] No sensitive data (private keys, off-chain secrets) appears in event topics or data

### 2.6 Storage Economics

- [x] Persistent storage entries are removed (not zero-written) when they reach a terminal state
- [x] No unbounded loops over storage — pagination used where enumeration is needed
- [x] Expired boosts are pruned on write paths to prevent unbounded growth
- [x] WASM size budget enforced via `contract/ci/wasm-size-budget.json` and `scripts/check-wasm-sizes.sh`

---

## 3. Soroban Best Practices Compliance

| Practice | Status | Notes |
|---|---|---|
| `resolver = "2"` in workspace Cargo.toml | ✅ | |
| `overflow-checks = true` in release profile | ✅ | |
| `panic = "abort"` in release profile | ✅ | Reduces WASM size; no unwinding |
| `lto = true`, `codegen-units = 1` | ✅ | Optimal WASM size |
| `opt-level = "z"` | ✅ | Size-optimised |
| No `std` in contract crates (`#![no_std]`) | ✅ | All contract crates |
| `soroban-sdk` version pinned at workspace level | ✅ | `soroban-sdk = "23"` |
| Auth checked before state mutation | ✅ | Verified per-contract |
| CEI pattern followed for cross-contract calls | ✅ (with noted blockers) | See §2.2 |
| No raw `unwrap()` on storage reads in production paths | ✅ | `expect("message")` used throughout |

---

## 4. Blockers (Must Fix Before Mainnet)

| ID | Contract | Issue | Severity | Reference |
|---|---|---|---|---|
| BLK-001 | tycoon-collectibles | `buy_collectible` allows free unlimited minting | Critical | CEI_SECURITY_AUDIT.md §2.7 |
| BLK-002 | tycoon-game | `admin_mint_registration_voucher` has no idempotency guard | Medium | CEI_SECURITY_AUDIT.md §2.5 |

---

## 5. Open Medium Issues

| ID | Contract | Issue | Severity |
|---|---|---|---|
| SW-CONTRACT-HYGIENE-001-M1 | tycoon-boost-system | No `set_admin` / admin key rotation | Medium |
| ~~SW-CONTRACT-HYGIENE-001-M2~~ | tycoon-reward-system | ~~No dedicated security checklist~~ | ✅ Resolved (SW-CT-037) |
| ~~SW-CONTRACT-HYGIENE-001-M3~~ | tycoon-game | ~~No dedicated security checklist~~ | ✅ Resolved (SW-CT-037) |

---

## 6. CI Requirements

Before merging any PR that touches `contract/`:

- [ ] `cargo check --workspace` passes (excludes `archive/` and `tycoon-main-game` per workspace exclusions)
- [ ] `cargo test --workspace` passes
- [ ] `contract/scripts/check-wasm-sizes.sh` passes (WASM within budget)
- [ ] This checklist reviewed and updated if new entrypoints or roles are added

---

## 7. External Audit

An external audit is recommended before mainnet deployment. See `CEI_SECURITY_AUDIT.md §6` for scope and estimated cost.

**Sign-off required from:** Tech Lead, Smart Contract Dev, Security Reviewer, External Auditor (pending).

---

## 8. Workspace Hygiene Checks (SW-CT-031)

These items must be verified on every PR that touches `contract/`.

### 8.1 Dependency Hygiene

- [x] `soroban-sdk` version pinned at workspace level — no per-crate version overrides
- [x] No transitive `std`-only dependencies in contract crates (all use `#![no_std]`)
- [x] `Cargo.lock` committed — ensures reproducible builds in CI
- [ ] Run `cargo audit` before each release to catch known CVEs

### 8.2 Code Hygiene

- [x] No `unsafe` blocks in any contract crate
- [x] No `unwrap()` on storage reads in hot paths — `expect("message")` used throughout
- [x] No `todo!()` or `unimplemented!()` in production code paths
- [x] Deprecated functions marked with `#[deprecated]` attribute and emit `DeprecatedFunctionCalledEvent`
- [x] Dead code removed or suppressed with `#[allow(dead_code)]` and a comment

### 8.3 Documentation Hygiene

- [x] Every public entrypoint has an `///` doc comment explaining purpose, auth, and panic conditions
- [x] Each contract has a `README.md` describing boost types, stacking rules, and API
- [x] `ACCEPTANCE_CRITERIA.md` exists for `tycoon-boost-system` (SW-CT-028)
- [x] `ENTRYPOINTS.md` exists for `tycoon-boost-system` (SW-CT-030)
- [x] `DEPRECATION_PLAN.md` exists and is up to date (SW-CT-029)
- [ ] `tycoon-reward-system` and `tycoon-game` still need `ACCEPTANCE_CRITERIA.md`

### 8.4 Test Hygiene

- [x] Each test module has a top-level doc comment explaining its scope
- [x] No `#[ignore]` tests left without a tracking issue comment
- [x] `should_panic` tests include `expected = "..."` to pin the panic message
- [x] Test helpers defined at module level, not copy-pasted per test
- [x] Integration tests live in `contract/integration-tests/` and are excluded from `cargo test --package` runs

### 8.5 CI Hygiene

- [x] `cargo check --workspace` must pass (gating on PR merge)
- [x] `cargo test --workspace` must pass
- [x] WASM size budget enforced by `scripts/check-wasm-sizes.sh`
- [ ] `cargo clippy --workspace -- -D warnings` not yet enforced in CI — track as hygiene debt
- [ ] `cargo fmt --check` not yet enforced in CI — track as hygiene debt

### 8.6 Security Documentation Hygiene

- [x] Per-contract `SECURITY_REVIEW_CHECKLIST.md` updated whenever new entrypoints are added
- [x] Findings table (SEC-XX) kept up to date with current status
- [x] Blockers (BLK-XX) in §4 above are never silently removed — must be resolved or deferred with justification
- [x] This workspace checklist reviewed and updated on every batch that adds/changes contract entrypoints
