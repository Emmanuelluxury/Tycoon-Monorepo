# Security Review Checklist — tycoon-token (SW-CT-001)

Stellar Wave · Contract (Soroban / Stellar)
Issue: SW-CT-001

---

## Scope

| Item | Value |
|------|-------|
| Contract | `tycoon-token` (crate `tycoon-token`) |
| Standard | SEP-41 fungible token |
| Review batch | Stellar Wave SW-CT-001 |
| Reviewer | _(assignee)_ |
| Review date | _(date)_ |
| Soroban SDK version | `23` |

---

## Threat Model

### Assets

| Asset | Description |
|-------|-------------|
| Token balances | `i128` values in persistent storage keyed by `Balance(Address)` |
| Total supply | `i128` in instance storage under `TotalSupply` |
| Admin key | Address stored under `Admin`; holds unlimited mint power |
| Allowances | `AllowanceValue { amount, expiration_ledger }` in persistent storage |

### Threat Actors

| Actor | Capability |
|-------|-----------|
| Unauthenticated caller | Can call any read-only entrypoint; cannot mutate state |
| Token holder | Can transfer, approve, burn their own tokens only |
| Approved spender | Can `transfer_from` / `burn_from` within their allowance window |
| Compromised admin | Can mint unbounded tokens; **admin key must be protected offline** |
| Contract upgrade deployer | No upgrade entrypoint exists; redeploy required for breaking changes |

### Attack Surfaces

| Surface | Risk | Mitigation |
|---------|------|-----------|
| Admin key exposure | Critical — unlimited mint | Require hardware key / multisig; `set_admin` emits auditable event |
| Allowance replay after expiry | High — stale spend | `AllowanceValue` stores expiry alongside amount; `transfer_from`/`burn_from` enforce it |
| Integer overflow on mint | High — silent wrap | `checked_add` on both balance and `total_supply`; panics on overflow |
| Integer underflow on burn | High — supply corruption | `checked_sub` on `total_supply`; explicit `>= amount` guard on balance |
| Double-initialization | Medium — state reset | `Initialized` key checked first; second call panics immediately |
| Negative amount injection | Medium — bypass validation | Explicit `< 0` / `<= 0` guards on all mutating entrypoints |
| Re-entrancy | N/A | No cross-contract calls; Soroban executes atomically |
| Oracle manipulation | N/A | No oracle or off-chain price feed used |

---

## Authorization & Access Control

| Entrypoint | Auth requirement | Status |
|-----------|-----------------|--------|
| `initialize` | None (one-time; guarded by `Initialized`) | ✅ |
| `mint` | Admin only — `require_admin()` → `admin.require_auth()` | ✅ |
| `set_admin` | Admin only — `require_admin()` | ✅ |
| `transfer` | Owner (`from.require_auth()`) | ✅ |
| `transfer_from` | Spender (`spender.require_auth()`) | ✅ |
| `approve` | Owner (`from.require_auth()`) | ✅ |
| `burn` | Owner (`from.require_auth()`) | ✅ |
| `burn_from` | Spender (`spender.require_auth()`) | ✅ |
| `balance`, `allowance`, `total_supply`, `admin`, `name`, `symbol`, `decimals` | None (read-only) | ✅ |
| `legacy_mint`, `legacy_burn`, `legacy_transfer` | None (always panics) | ✅ |

**`require_admin` helper** — centralises admin retrieval and auth; used by `mint` and `set_admin` only.  
No entrypoint skips `require_auth()` for a state-mutating operation.

---

## Input Validation

| Entrypoint | Input | Validation | Status |
|-----------|-------|-----------|--------|
| `initialize` | `initial_supply` | Rejects `< 0`; no re-init after `Initialized` key set | ✅ |
| `mint` | `amount` | Rejects `<= 0` (`"Amount must be positive"`) | ✅ |
| `transfer` | `amount` | Rejects `< 0`; zero is no-op | ✅ |
| `transfer_from` | `amount` | Rejects `< 0`; zero is no-op | ✅ |
| `approve` | `amount` | Rejects `< 0`; zero clears the allowance | ✅ |
| `burn` | `amount` | Rejects `<= 0` | ✅ |
| `burn_from` | `amount` | Rejects `<= 0` | ✅ |

All balance-deducting paths check `balance >= amount` before any mutation.

---

## Allowance Expiry

| Check | Implementation | Status |
|-------|---------------|--------|
| `AllowanceValue` stores `amount + expiration_ledger` atomically | Cannot strip expiry from the record | ✅ |
| `allowance()` returns `0` when `seq > expiration_ledger` | No stale reads | ✅ |
| `transfer_from` enforces expiry before deducting allowance | Panics `"Allowance expired"` | ✅ |
| `burn_from` enforces expiry before deducting allowance | Panics `"Allowance expired"` | ✅ |
| `expiration_ledger = 0` means permanent (no expiry) | Skips the expiry check when `0` | ✅ |
| Re-approval after expiry resets the allowance | Covered by `test_approve_zero_clears_allowance` | ✅ |

---

## Arithmetic Safety

| Operation | Guard | Panic message | Status |
|-----------|-------|--------------|--------|
| `mint` — balance += amount | `checked_add` | `"Balance overflow"` | ✅ |
| `mint` — supply += amount | `checked_add` | `"Supply overflow"` | ✅ |
| `transfer` / `transfer_from` — recipient balance += amount | `checked_add` | `"Balance overflow"` | ✅ |
| `burn` — balance -= amount | Explicit `>= amount` guard, then plain sub | No underflow possible | ✅ |
| `burn` — supply -= amount | `checked_sub` | `"Supply underflow"` | ✅ |
| `burn_from` — balance and supply | Same as `burn` | Same | ✅ |

No silent integer wrap is possible. All paths either guard with `>=` or use checked arithmetic.

---

## Event Emission

| Operation | Event | Topics | Data |
|-----------|-------|--------|------|
| `initialize` | `MintEvent` | `(contract, "mint", to)` | `initial_supply` |
| `mint` | `MintEvent` | `(contract, "mint", to)` | `amount` |
| `transfer` / `transfer_from` | `TransferEvent` | `(contract, "transfer", from, to)` | `amount` |
| `approve` | `ApproveEvent` | `(contract, "approve", from, spender)` | `(amount, expiration_ledger)` |
| `burn` / `burn_from` | `BurnEvent` | `(contract, "burn", from)` | `amount` |
| `set_admin` | `SetAdminEvent` | `(contract, "set_admin", old_admin, new_admin)` | _(none)_ |

No state-mutating entrypoint is silent. Admin rotation is auditable via `SetAdminEvent`.

---

## Reentrancy / CEI

Soroban contracts execute in a single-host call; there is no mid-call re-entry mechanism.
This contract makes **no cross-contract calls**, so CEI ordering is not applicable.

---

## Oracle & Privileged Off-Chain Patterns

- ✅ No external oracle or price feed
- ✅ No privileged off-chain keeper or relayer
- ✅ No unaudited external dependency in production paths

---

## Storage Economics

| Key class | Storage tier | Notes |
|-----------|-------------|-------|
| `Initialized`, `Admin`, `TotalSupply` | Instance | Shared TTL with contract instance |
| `Balance(Address)` | Persistent | Per-account; callers should top-up TTL before expiry to avoid state loss |
| `Allowance(Address, Address)` | Persistent | Per (owner, spender) pair; same TTL concern |

See `contract/docs/STORAGE_ECONOMICS.md` for TTL management guidance.

---

## Known Findings & Resolutions

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SEC-01 | High | `initialize` accepted negative `initial_supply` | ✅ Fixed — validation added |
| SEC-02 | High | `approve` stored `expiration_ledger` but it was never enforced | ✅ Fixed — `AllowanceValue` struct + expiry checks in `transfer_from` / `burn_from` / `allowance` |
| SEC-03 | High | `burn` / `burn_from` used unchecked subtraction on `total_supply` | ✅ Fixed — `checked_sub` |
| SEC-04 | Medium | `set_admin` emitted no event, making admin rotation unauditable | ✅ Fixed — `SetAdminEvent` added |
| SEC-05 | Low | Legacy entrypoints silently succeeded rather than surfacing a clear migration message | ✅ Fixed — deprecated entrypoints panic with explicit message |

No unresolved findings.

---

## Test Coverage

| Area | Module | Test(s) |
|------|--------|---------|
| Initialize / metadata | `test` | `test_initialization` |
| Double-init guard | `test` | `test_cannot_reinitialize` |
| Admin mint (positive) | `test` | `test_admin_can_mint` |
| Admin mint (zero rejected) | `test` | `test_cannot_mint_zero` |
| Transfer (success / failure) | `test` | `test_transfer`, `test_transfer_insufficient_balance` |
| Approve + transfer_from | `test` | `test_approve_and_transfer_from`, `test_transfer_from_insufficient_allowance` |
| Burn / burn_from | `test` | `test_burn`, `test_burn_from`, `test_burn_insufficient_balance`, `test_burn_from_insufficient_allowance` |
| set_admin | `test` | `test_set_admin`, `test_new_admin_can_mint` |
| Simulation scenarios | `simulation_scenarios` | `sim_*` (game reward, delegated stake, multi-player, admin rotation, burn-from fee) |
| Supply invariants (INV-01 – INV-17) | `invariant_tests` | `test_inv_*` |
| Error branches | `error_branch_tests` | `test_transfer_negative_amount`, `test_approve_*`, etc. |
| Access control | `access_control_tests` | `admin_can_mint`, `non_admin_cannot_mint`, etc. |
| Deprecation guards | `deprecation_tests` | `legacy_mint_always_panics`, etc. |
| Security review items (SEC-01 – SEC-07) | `security_review_tests` | `test_sec_*` |
| Additional unit / integration coverage | `unit_coverage_tests` | `transfer_from_expiry_edge_*`, `approve_boundary_*`, `integration_*` |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author / Implementer | _(name)_ | _(date)_ | _(initials)_ |
| Security Reviewer | _(name)_ | _(date)_ | _(initials)_ |
| Engineering Lead | _(name)_ | _(date)_ | _(initials)_ |

> By signing, the reviewer confirms that all items in this checklist have been verified against the contract source at the commit referenced in the associated PR.

---

## References

- Stellar Wave batch: SW-CT-001
- Soroban SEP-41 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
- Related docs: `README.md`, `ACCEPTANCE_CRITERIA.md`, `contract/docs/STORAGE_ECONOMICS.md`, `contract/docs/security-testing.md`
- Related contracts: `tycoon-reward-system` (calls `mint`), `tycoon-collectibles` (uses TYC as payment)
