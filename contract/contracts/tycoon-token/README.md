# TycoonToken (TYC)

A SEP-41 compliant fungible token on Stellar Soroban, ported from the ERC-20 TycoonToken Solidity contract.

## Overview

**Name:** Tycoon  
**Symbol:** TYC  
**Decimals:** 18  
**Initial Supply:** 1,000,000,000 TYC (1 billion tokens)  
**Standard:** SEP-41 Token Interface

## Features

- ✅ SEP-41 TokenInterface implementation (transfer, approve, allowance, burn, etc.)
- ✅ Admin-controlled minting with overflow protection
- ✅ Burnable tokens (self-burn and burn_from with allowance)
- ✅ Admin transfer capability
- ✅ One-time initialization
- ✅ Full event emissions (transfer, mint, burn, approve)
- ✅ **Migration & upgrade governance** (admin-controlled state versioning)

## Key Differences from Solidity/ERC-20

### Authorization
**Solidity:** Uses `onlyOwner` modifier and implicit `msg.sender`
```solidity
modifier onlyOwner() { require(msg.sender == owner); _; }
```

**Soroban:** Uses explicit `require_auth()` with cryptographic verification
```rust
admin.require_auth();  // Verifies signature
```

### Storage
**Solidity:** Inherits mappings from OpenZeppelin
```solidity
mapping(address => uint256) private _balances;
```

**Soroban:** Custom storage with DataKey enum
```rust
pub enum DataKey {
    Balance(Address),
    Allowance(Address, Address),
}
```

### Events
**Solidity:** `emit Transfer(from, to, amount);`  
**Soroban:** `env.events().publish((String::from_str(&e, "transfer"), from, to), amount);`

### Types
**Solidity:** `uint256` (unsigned)  
**Soroban:** `i128` (signed, SEP-41 standard)

## Functions

### Initialization
```rust
initialize(admin: Address, initial_supply: i128)
```
Initialize token and mint initial supply to admin. Can only be called once.

### Admin Functions
```rust
mint(to: Address, amount: i128)           // Mint tokens (admin only)
set_admin(new_admin: Address)             // Transfer admin rights (admin only)
migrate()                                 // Migrate contract to newer state version (admin only)
admin() -> Address                        // Get current admin
total_supply() -> i128                    // Get total supply
state_version() -> u32                    // Get current state version (public)
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

### Metadata
```rust
name() -> String      // Returns "Tycoon"
symbol() -> String    // Returns "TYC"
decimals() -> u32     // Returns 18
```

## Building

```bash
cd contract/contracts/tycoon-token
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test --package tycoon-token
```

Test modules and coverage:

| Module | Description |
|---|---|
| `src/test.rs` | Core functional tests + simulation scenarios (SW-1) |
| `src/invariant_tests.rs` | Mint/burn invariants INV-01 – INV-17 |
| `src/error_branch_tests.rs` | Error path coverage |
| `src/access_control_tests.rs` | Admin-only vs public entrypoint enforcement |
| `src/deprecation_tests.rs` | Legacy entrypoint deprecation guards |
| `src/migration_tests.rs` | Migration & upgrade governance (MIG-01 – MIG-12) |
| `src/security_review_tests.rs` | Security checklist items SEC-01 – SEC-07 |
| `src/simulation_scenarios.rs` | End-to-end simulation scenarios (SIM-01 – SIM-05) |

## Deployment

```bash
# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source <ADMIN_SECRET> \
  --network testnet

# Initialize with 1B tokens
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --initial_supply 1000000000000000000000000000
```

## Usage Examples

### Mint Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- mint \
  --to <USER_ADDRESS> \
  --amount 1000000000000000000000
```

### Transfer Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- transfer \
  --from <FROM_ADDRESS> \
  --to <TO_ADDRESS> \
  --amount 1000000000000000000
```

### Approve and Transfer From
```bash
# Approve
stellar contract invoke --id <CONTRACT_ID> -- approve \
  --from <OWNER_ADDRESS> \
  --spender <SPENDER_ADDRESS> \
  --amount 1000000000000000000 \
  --expiration_ledger 0

# Transfer from
stellar contract invoke --id <CONTRACT_ID> -- transfer_from \
  --spender <SPENDER_ADDRESS> \
  --from <OWNER_ADDRESS> \
  --to <RECIPIENT_ADDRESS> \
  --amount 1000000000000000000
```

### Burn Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- burn \
  --from <FROM_ADDRESS> \
  --amount 1000000000000000000
```

## Integration with TycoonRewardSystem

```rust
use tycoon_token::TycoonTokenClient;

pub fn reward_user(e: &Env, token_address: Address, user: Address, amount: i128) {
    let token = TycoonTokenClient::new(e, &token_address);
    token.mint(&user, &amount);
}
```

## Migration & Upgrade Governance

The TycoonToken contract includes built-in migration support to enable safe contract upgrades without losing state.

### State Versioning

Every contract instance tracks a `StateVersion` that can be queried by any caller:

```bash
stellar contract invoke --id <CONTRACT_ID> -- state_version
# Returns: 1 (current version)
```

### Migrating Legacy Contracts

If you have a legacy contract deployed before state versioning was added (version 0), the admin can migrate it:

```bash
stellar contract invoke --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- migrate
```

**What happens during migration:**
- Version 0 → 1: Sets the StateVersion to 1 (enables versioning)
- Version 1 → 1: No-op (safe to call multiple times)
- Future versions: Placeholder for additional migrations

### Security Model

- **Admin-only**: Only the contract admin can call `migrate()`
- **Idempotent**: Safe to call multiple times without side effects
- **State preservation**: All balances, allowances, and total supply are preserved
- **Non-disruptive**: Token operations continue to work during and after migration

### Testing Migration

The contract includes comprehensive migration tests in `src/migration_tests.rs`:

```bash
cargo test --package tycoon-token migration_tests
```

Test coverage includes:
- Admin authorization enforcement
- State version tracking
- V0 to V1 migration
- Idempotency at V1
- Balance and allowance preservation
- Post-migration functionality

## Security Considerations

- Admin has unlimited minting power - secure admin key properly
- No maximum supply cap - admin can mint indefinitely
- Burning is irreversible and reduces total supply
- Authorization checks prevent unauthorized operations
- Overflow protection on all arithmetic operations
- **Migration governance:** Only admin can upgrade contract state version
- **State version tracking:** All state changes are versioned for upgrade safety

## Mint/Burn Invariants

The following invariants are enforced by the contract and verified by `src/invariant_tests.rs`:

| ID     | Invariant |
|--------|-----------|
| INV-01 | `total_supply` always equals the sum of all individual balances |
| INV-02 | `total_supply` increases by exactly `amount` on every successful `mint` |
| INV-03 | `total_supply` decreases by exactly `amount` on every successful `burn` / `burn_from` |
| INV-04 | `total_supply` is never negative |
| INV-05 | Minting zero or a negative amount is rejected (`"Amount must be positive"`) |
| INV-06 | Burning zero or a negative amount is rejected (`"Amount must be positive"`) |
| INV-07 | Burning more than a holder's balance is rejected (`"Insufficient balance"`) |
| INV-08 | `burn_from` is rejected when allowance is insufficient (`"Insufficient allowance"`) |
| INV-09 | Arithmetic overflow on `mint` is caught and panics — no silent wrap (`checked_add`) |
| INV-10 | Sequential mint → burn round-trip restores the original `total_supply` |
| INV-11 | Multiple independent mints accumulate correctly in `total_supply` |
| INV-12 | Multiple independent burns reduce `total_supply` correctly |
| INV-13 | Burning the entire supply of a holder reduces `total_supply` to zero |
| INV-14 | `burn_from` reduces both the holder's balance and the spender's allowance |
| INV-15 | Only the admin can mint; non-admin callers are rejected by `require_auth()` |
| INV-16 | `MintEvent` is emitted with correct `to` and `amount` on every mint (including init) |
| INV-17 | `BurnEvent` is emitted with correct `from` and `amount` on every burn / `burn_from` |

> **Supply cap:** There is intentionally no hard supply cap. The practical ceiling is `i128::MAX` (~1.7 × 10³⁸), enforced by `checked_add` overflow guards on both `total_supply` and individual balances.

## Events

All operations emit events:
- **transfer**: `("transfer", from, to)` → `amount`
- **mint**: `("mint", to)` → `amount`
- **burn**: `("burn", from)` → `amount`
- **approve**: `("approve", from, spender)` → `(amount, expiration)`

## License

MIT
