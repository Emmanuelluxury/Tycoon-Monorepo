# TycoonToken Migration & Upgrade Governance

**Issue:** SW-CON-1037  
**Status:** Implemented  
**Last Updated:** 2026-06-26

---

## Overview

This document describes the migration and upgrade governance system for the TycoonToken contract. The system provides a safe, admin-controlled mechanism for upgrading contract state without losing data or disrupting token operations.

---

## Architecture

### State Versioning

The contract tracks a `StateVersion` field that identifies the current state schema:

```rust
pub enum DataKey {
    // ... existing keys
    StateVersion,
}
```

**Version History:**
- **v0**: Legacy contracts deployed before migration support (implicit version)
- **v1**: Current version with migration governance (set by `initialize()` or `migrate()`)

### Access Control

All migration operations are **admin-only**:

```rust
pub fn migrate(e: Env) {
    require_admin(&e);  // Enforces admin authorization
    
    let current_version = e.storage()
        .instance()
        .get(&DataKey::StateVersion)
        .unwrap_or(0);
    
    if current_version == 0 {
        // Upgrade v0 → v1
        e.storage().instance().set(&DataKey::StateVersion, &1u32);
    }
    // v1 → v1: no-op (idempotent)
}
```

---

## Migration Paths

### Path 1: New Deployments (v1 from Start)

New contracts deployed after this feature automatically start at version 1:

```bash
stellar contract invoke --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --initial_supply 1000000000000000000000000000
```

After initialization:
```bash
stellar contract invoke --id <CONTRACT_ID> -- state_version
# Output: 1
```

### Path 2: Migrating Legacy Contracts (v0 → v1)

Contracts deployed before this feature have an implicit version of 0. To upgrade:

```bash
# 1. Verify current version
stellar contract invoke --id <CONTRACT_ID> -- state_version
# Output: 0

# 2. Run migration (admin-only)
stellar contract invoke --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network <testnet|mainnet> \
  -- migrate

# 3. Verify upgrade succeeded
stellar contract invoke --id <CONTRACT_ID> -- state_version
# Output: 1
```

### Path 3: Future Migrations (v1 → v2)

The `migrate()` function includes a placeholder for future migrations:

```rust
} else if current_version == 1 {
    // Placeholder for future migration v1 → v2
    // Example: add new storage fields, update indexes, etc.
}
```

When a v2 migration is needed, the implementation would:
1. Detect current_version == 1
2. Perform necessary state transformations
3. Set StateVersion to 2
4. Update tests and documentation

---

## Safety Guarantees

### Idempotency

`migrate()` can be called multiple times safely:

```bash
# First call: v0 → v1
stellar contract invoke --id <ID> --source <ADMIN> -- migrate
# Output: StateVersion = 1

# Second call: v1 → v1 (no-op)
stellar contract invoke --id <ID> --source <ADMIN> -- migrate
# Output: StateVersion = 1 (unchanged)
```

### State Preservation

Migration does **not** modify existing data:

| State | Preserved? | Notes |
|-------|-----------|-------|
| Balances | ✅ Yes | All user balances remain unchanged |
| Allowances | ✅ Yes | All approvals and expirations remain valid |
| Total Supply | ✅ Yes | Token supply is preserved exactly |
| Admin | ✅ Yes | Admin address is not changed |

### Non-Disruptive

Token operations work before, during, and after migration:

```bash
# Before migration (v0)
stellar contract invoke --id <ID> -- transfer --from <A> --to <B> --amount 1000
# ✅ Works

# Run migration
stellar contract invoke --id <ID> --source <ADMIN> -- migrate

# After migration (v1)
stellar contract invoke --id <ID> -- transfer --from <A> --to <B> --amount 1000
# ✅ Still works
```

---

## Testing

### Test Coverage

The `src/migration_tests.rs` module provides 12 test scenarios:

| Test ID | Scenario |
|---------|----------|
| MIG-01 | `migrate` rejects non-admin callers |
| MIG-02 | `state_version` returns 1 after `initialize` |
| MIG-03 | `migrate` at v1 is idempotent (no-op) |
| MIG-04 | `migrate` upgrades v0 → v1 correctly |
| MIG-05 | `migrate` preserves all balances |
| MIG-06 | `migrate` preserves all allowances |
| MIG-07 | `migrate` can be called multiple times |
| MIG-08 | `state_version` is publicly readable (no auth required) |
| MIG-09 | `migrate` requires admin authorization |
| MIG-10 | All token operations work after migration |
| MIG-11 | Admin transfer works after migration |
| MIG-12 | Full workflow: legacy contract → migrate → normal operations |

### Running Tests

```bash
cd contract/contracts/tycoon-token

# Run all migration tests
cargo test --lib migration_tests

# Run a specific test
cargo test --lib mig_04_migrate_v0_to_v1

# Run all tests (includes migration tests)
cargo test --lib
```

---

## Deployment Workflow

### Testnet Validation

Before deploying to mainnet, validate the migration on testnet:

```bash
# 1. Deploy a legacy contract (simulate v0)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source <ADMIN_SECRET> \
  --network testnet

# 2. Manually bootstrap v0 state (admin, balances, etc.)
# ... (use stellar contract invoke with manual storage setup)

# 3. Verify version is 0
stellar contract invoke --id <ID> --network testnet -- state_version

# 4. Run migration
stellar contract invoke --id <ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- migrate

# 5. Verify version is now 1
stellar contract invoke --id <ID> --network testnet -- state_version

# 6. Test token operations still work
stellar contract invoke --id <ID> --network testnet \
  -- transfer --from <A> --to <B> --amount 1000
```

### Mainnet Migration

After testnet validation:

```bash
# 1. Announce migration window to users (optional, non-disruptive)
# 2. Run migration on production contract
stellar contract invoke --id <PROD_CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network mainnet \
  -- migrate

# 3. Verify state version
stellar contract invoke --id <PROD_CONTRACT_ID> \
  --network mainnet \
  -- state_version

# 4. Monitor contract activity for anomalies
# 5. Document migration completion in deployment log
```

---

## Security Considerations

### Admin Key Security

- Migration is a **privileged operation** — secure the admin key appropriately
- Use hardware wallet (Ledger) for mainnet migrations (see DEPLOYMENT_RUNBOOK.md)
- Consider multisig for high-value contracts

### Migration Timing

- Migration is **non-disruptive** — no need to pause the contract
- Can be performed during normal operation
- No downtime required

### Rollback

- Migration is **one-way** (v0 → v1 cannot be reversed on-chain)
- If issues are detected, deploy a new contract instance with corrected logic
- User balances can be migrated to new contract if needed (admin-controlled mint)

### Audit Trail

All migrations emit contract events implicitly through state changes. Monitor:
- `state_version()` changes via contract queries
- Admin authorization logs
- Transaction history on the admin account

---

## API Reference

### `migrate() -> ()`

Migrates the contract to the latest state version.

**Access:** Admin-only  
**Idempotent:** Yes (safe to call multiple times)  
**State Changes:**
- v0: Sets StateVersion to 1
- v1: No-op

**Example:**
```bash
stellar contract invoke --id <ID> --source <ADMIN> -- migrate
```

### `state_version() -> u32`

Returns the current state version.

**Access:** Public (anyone can call)  
**Returns:** `0` (legacy), `1` (current), or higher (future)

**Example:**
```bash
stellar contract invoke --id <ID> -- state_version
# Output: 1
```

---

## Future Extensions

### Planned Features

- **v2 Migration:** Potential future upgrade for new features
- **Migration Events:** Explicit event emission for state version changes
- **Version History:** Track all migration timestamps and admin addresses

### Extension Pattern

To add a new migration (e.g., v1 → v2):

```rust
pub fn migrate(e: Env) {
    require_admin(&e);
    
    let current_version = e.storage()
        .instance()
        .get(&DataKey::StateVersion)
        .unwrap_or(0);
    
    if current_version == 0 {
        // v0 → v1
        e.storage().instance().set(&DataKey::StateVersion, &1u32);
    } else if current_version == 1 {
        // v1 → v2 (new migration)
        // 1. Transform state as needed
        // 2. Add new storage fields
        // 3. Update version
        e.storage().instance().set(&DataKey::StateVersion, &2u32);
    }
    // v2 → v2: no-op
}
```

---

## References

- **Issue:** [#1037 - Crate tycoon-token — upgrade / migration key governance](https://github.com/SaboStudios/Tycoon-Monorepo/issues/1037)
- **Related Docs:**
  - `README.md` — User-facing migration guide
  - `DEPLOYMENT_RUNBOOK.md` — Deployment procedures
  - `CHANGELOG.md` — Version history
- **Test Module:** `src/migration_tests.rs`
- **Implementation:** `src/lib.rs` (lines 114-130)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-06-26 | Kiro (SW-CON-1037) | Initial migration governance implementation |

