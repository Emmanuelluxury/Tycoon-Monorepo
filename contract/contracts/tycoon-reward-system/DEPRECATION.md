# Deprecation Guide — tycoon-reward-system (SW-CT-017)

## Deprecated Entrypoint: `redeem_voucher`

### Status

`redeem_voucher(token_id: u128)` is **fully deprecated** as of v0.1.0.

### Why It Was Deprecated

The original entrypoint accepted only a `token_id` and relied on implicit
transaction origin for authorization. This made the auth path ambiguous under
Soroban's explicit-auth model, where every privileged address must call
`require_auth()` explicitly.

The replacement `redeem_voucher_from(redeemer, token_id)` makes the authorized
address an explicit parameter and calls `redeemer.require_auth()` directly,
which is the correct Soroban pattern.

### Replacement

| Deprecated | Replacement |
|---|---|
| `redeem_voucher(token_id)` | `redeem_voucher_from(redeemer, token_id)` |

### Current Behavior

Calling `redeem_voucher` **always panics** with:

```
"Use redeem_voucher_from instead"
```

The stub is intentionally retained so that callers using outdated client
code receive an actionable error message rather than a silent failure or a
generic contract error.

### Migration Steps

**Before:**
```rust
client.redeem_voucher(&token_id);
```

**After:**
```rust
// Pass the voucher owner as the first argument.
// The caller must sign for `redeemer` in the transaction's auth envelope.
client.redeem_voucher_from(&redeemer, &token_id);
```

### Removal Plan

`redeem_voucher` will be removed in the next major state migration. Removal
will be coordinated with a `DataKey::StateVersion` bump so that on-chain
tooling can detect the transition. No storage keys are affected by the
removal since the stub performs no storage reads or writes.

### Test Coverage

The deprecated stub is covered by:
- `test_redeem_voucher_deprecated_always_panics` (`src/test.rs`)
- `test_redeem_voucher_deprecated_panics` (`src/test.rs`)
