# TycoonToken (TYC)

A SEP-41 compliant fungible token on Stellar Soroban.

Stellar Wave batch: **SW-CT-001 · SW-CT-002 · SW-CT-003 · SW-CT-004**

---

## Overview

| Property | Value |
|----------|-------|
| Name | Tycoon |
| Symbol | TYC |
| Decimals | 18 |
| Initial supply | 1,000,000,000 TYC (1 billion) |
| Standard | SEP-41 Token Interface |
| Soroban SDK | 23 |

---

## Contract Entrypoints

### Initialization

```rust
initialize(admin: Address, initial_supply: i128)
```

One-time setup. Mints `initial_supply` to `admin`. Panics if called twice or with a negative supply.

### Admin Functions

```rust
mint(to: Address, amount: i128)           // Mint new tokens — admin only
set_admin(new_admin: Address)             // Rotate admin key — admin only
admin() -> Address                        // Read current admin (no auth)
total_supply() -> i128                    // Read total supply (no auth)
```

### SEP-41 Token Operations

```rust
transfer(from: Address, to: Address, amount: i128)
transfer_from(spender: Address, from: Address, to: Address, amount: i128)
approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)
allowance(from: Address, spender: Address) -> i128
balance(id: Address) -> i128
burn(from: Address, amount: i128)
burn_from(spender: Address, from: Address, amount: i128)
```

### Metadata (read-only, no auth)

```rust
name() -> String      // "Tycoon"
symbol() -> String    // "TYC"
decimals() -> u32     // 18
```

### Legacy Entrypoints (deprecated)

```rust
legacy_mint(_to: Address, _amount: i128)          // always panics
legacy_burn(_from: Address, _amount: i128)        // always panics
legacy_transfer(_from, _to: Address, _amount)     // always panics
```

These exist only to surface a clear migration message. Do not call them from new code.

---

## Allowance Expiry

`approve` accepts an `expiration_ledger: u32` parameter.

- `expiration_ledger = 0` → permanent allowance (never expires).
- `expiration_ledger = N` → valid while `ledger.sequence <= N`; expired at `N + 1`.

`allowance()` returns `0` for expired entries. `transfer_from` and `burn_from` reject expired allowances with `"Allowance expired"`.

---

## Building

```bash
cd contract/contracts/tycoon-token
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
# Unit + integration tests (no Soroban testnet required)
cargo test --package tycoon-token

# Type-check only (fast)
cargo check --package tycoon-token
```

### Test modules

| Module | Description |
|--------|-------------|
| `test` | Core happy-path and basic error cases |
| `invariant_tests` | INV-01 through INV-17 supply/balance invariants |
| `error_branch_tests` | Negative amounts, zero no-ops, pre-init panics, inline snapshots |
| `access_control_tests` | Admin-only vs public entrypoint boundaries |
| `deprecation_tests` | Legacy entrypoint panic messages and supply-safety |
| `security_review_tests` | SEC-01 through SEC-07 from the security checklist |
| `unit_coverage_tests` | Transfer_from expiry edge cases, approve boundaries, integration chains (SW-CT-002) |
| `simulation_scenarios` | Complex multi-step game scenarios: tournament, escrow, staking (SW-CT-003) |

---

## Mint / Burn Invariants

| ID | Invariant |
|----|-----------|
| INV-01 | `total_supply` always equals the sum of all individual balances |
| INV-02 | `total_supply` increases by exactly `amount` on every successful `mint` |
| INV-03 | `total_supply` decreases by exactly `amount` on every successful `burn` / `burn_from` |
| INV-04 | `total_supply` is never negative |
| INV-05 | Minting zero or negative is rejected (`"Amount must be positive"`) |
| INV-06 | Burning zero or negative is rejected (`"Amount must be positive"`) |
| INV-07 | Burning more than balance is rejected (`"Insufficient balance"`) |
| INV-08 | `burn_from` with insufficient allowance is rejected |
| INV-09 | Arithmetic overflow on `mint` panics — no silent wrap |
| INV-10 | Mint → burn round-trip restores original `total_supply` |
| INV-11 | Multiple mints accumulate correctly |
| INV-12 | Multiple burns reduce `total_supply` correctly |
| INV-13 | Burning entire supply reaches zero |
| INV-14 | `burn_from` reduces both balance and allowance |
| INV-15 | Only admin can mint |
| INV-16 | `MintEvent` emitted with correct fields on every mint |
| INV-17 | `BurnEvent` emitted with correct fields on every burn |

No hard supply cap. Practical ceiling is `i128::MAX` (~1.7 × 10³⁸), enforced by `checked_add`.

---

## Events

| Operation | Event struct | Topics | Data |
|-----------|-------------|--------|------|
| `initialize` / `mint` | `MintEvent` | `(contract, "mint", to)` | `amount` |
| `transfer` / `transfer_from` | `TransferEvent` | `(contract, "transfer", from, to)` | `amount` |
| `approve` | `ApproveEvent` | `(contract, "approve", from, spender)` | `(amount, expiration_ledger)` |
| `burn` / `burn_from` | `BurnEvent` | `(contract, "burn", from)` | `amount` |
| `set_admin` | `SetAdminEvent` | `(contract, "set_admin", old, new)` | — |

All state-mutating entrypoints emit an event. Admin rotation is auditable via `SetAdminEvent`.

---

## Storage Layout

| Key | Tier | Notes |
|-----|------|-------|
| `Initialized` | Instance | One-time init guard |
| `Admin` | Instance | Current admin address |
| `TotalSupply` | Instance | Aggregate supply |
| `Balance(Address)` | Persistent | Per-account balance |
| `Allowance(Address, Address)` | Persistent | Per `(owner, spender)` allowance + expiry |

See `contract/docs/STORAGE_ECONOMICS.md` for TTL management.

---

## Deployment

```bash
# Build
stellar contract build

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source <ADMIN_SECRET> \
  --network testnet

# Initialize (1 billion TYC)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --initial_supply 1000000000000000000000000000
```

## Rollout / Migration Notes

1. Call `initialize(admin, initial_supply)` once on deploy. All `initial_supply` goes to `admin`.
2. Admin key holds unlimited mint power — protect it with a hardware key or multisig.
3. To rotate admin: call `set_admin(new_admin)` from the current admin. This emits `SetAdminEvent`.
4. Legacy entrypoints (`legacy_mint`, `legacy_burn`, `legacy_transfer`) are retained for explicit deprecation panics. Remove them only after all callers have migrated.
5. No `migrate` entrypoint — redeploy required for breaking state changes.
6. TTL management: `Balance` and `Allowance` are in persistent storage. Bump TTL before expiry to avoid losing state on infrequently-used accounts.

---

## Security

See `SECURITY_REVIEW_CHECKLIST.md` for the full threat model and sign-off table.

Key points:
- Admin is the only privileged role; all admin paths call `require_admin()`.
- All arithmetic uses `checked_add` / `checked_sub` — no silent overflow.
- `AllowanceValue` stores amount + expiry atomically — expiry cannot be stripped.
- No oracle, no cross-contract calls, no re-entrancy risk.

---

## Integration

```rust
use tycoon_token::TycoonTokenClient;

pub fn reward_player(e: &Env, token: Address, player: Address, amount: i128) {
    TycoonTokenClient::new(e, &token).mint(&player, &amount);
}
```

Related contracts:
- `tycoon-reward-system` — calls `mint` to distribute rewards
- `tycoon-collectibles` — uses TYC as the payment currency

---

## License

MIT
