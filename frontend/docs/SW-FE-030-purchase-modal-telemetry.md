# SW-FE-030 — Purchase Modal: Telemetry Hooks (Privacy-Safe)

Part of the **Stellar Wave** engineering batch.

## Summary

The `usePurchaseModalTelemetry` hook and the `analyticsEventSchema` taxonomy
entries for the Purchase modal were already in place from an earlier batch.
This issue verified completeness and confirmed the implementation is
privacy-safe end-to-end.

## Verified taxonomy (no changes required)

All three required events are present in `src/lib/analytics/taxonomy.ts`:

```ts
purchase_modal_viewed:   ["route", "item_name", "currency", "value"]
purchase_modal_canceled: ["route", "item_name", "currency", "value"]
purchase_modal_confirmed:["route", "item_name", "currency", "value"]
```

No PII fields (`user_id`, `wallet_address`, `email`, `token`, `session_id`)
appear in any of these schemas. `sanitizeAnalyticsPayload` enforces this
allowlist automatically at call time.

## Hook wiring in PurchaseModal

| Event | Trigger |
|-------|---------|
| `purchase_modal_viewed` | `useEffect` fires when `isOpen` becomes `true` |
| `purchase_modal_canceled` | `handleClose` fires on × / Cancel / backdrop / Escape |
| `purchase_modal_confirmed` | `handleConfirm` fires on the Confirm button |

All payloads use the sanitized values (`safeName`, `safePrice`, `safeCurrency`)
— the same strings rendered in the UI — so raw user-supplied HTML is never
forwarded to the analytics pipeline.

## Privacy guarantees

- No user IDs, wallet addresses, session tokens, or IP addresses are ever sent.
- `item_name` is the sanitized display string; not a database ID.
- `value` is the displayed price string; not a transaction amount.
- `sanitizeAnalyticsPayload` strips any fields outside the allowlist at runtime.

## No new dependencies

No new packages required.

## Feature flag / rollout

No runtime flag needed. Telemetry fires on every modal open/close/confirm.
If the analytics provider is not initialised (e.g. ad-blocker, SSR), `track()`
is a no-op and no errors are thrown.

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-030
- [x] All three `purchase_modal_*` events are in the taxonomy schema
- [x] No PII fields in any purchase modal schema
- [x] `purchase_modal_viewed` fires on open
- [x] `purchase_modal_canceled` fires on close
- [x] `purchase_modal_confirmed` fires on confirm
- [x] Telemetry payloads use sanitized strings only
