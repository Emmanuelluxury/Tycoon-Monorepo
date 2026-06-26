# SW-FE-031 — Purchase Modal: Security Hardening Review

Part of the **Stellar Wave** engineering batch.

## Review scope

All string props accepted by `PurchaseModal` (`itemName`, `itemPrice`,
`itemCurrency`, `error`) are untrusted user-supplied or server-supplied data.
This review audits XSS vectors, PII leakage, and CSP compatibility.

## Findings & mitigations

### 1. HTML injection via string props (mitigated)

`itemName`, `itemPrice`, and `itemCurrency` are rendered directly into JSX.
React escapes them by default, but a `<b>Boost</b>` name would render as
literal text rather than the intended label. Any downstream code using
`dangerouslySetInnerHTML` would be a full XSS vector.

**Mitigation**: `sanitizeText()` strips all HTML tags (`/<[^>]*>/g`) before
rendering or forwarding to analytics. This runs before the first render and
in every `useEffect` that depends on these strings.

```ts
function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}
```

### 2. PII in analytics payloads (mitigated)

Telemetry payloads must not include user identifiers.

**Mitigation**: The analytics taxonomy allowlist (`analyticsEventSchema`) for
all three `purchase_modal_*` events contains only `route`, `item_name`,
`currency`, and `value`. `sanitizeAnalyticsPayload` silently drops any field
outside the allowlist. Verified in tests.

### 3. Inline styles / eval (no issue found)

No inline `style={{ ... }}` assignments and no `eval` / `new Function` calls
exist in the component. All styling is done via Tailwind utility classes, which
are CSP-safe (no inline style nonces required).

### 4. `dangerouslySetInnerHTML` (no issue found)

No `dangerouslySetInnerHTML` usage exists in the component or its
sub-components (`Button`, `Card`, `CardHeader`, etc.).

### 5. Scroll-lock side-effect (no issue found)

`document.body.style.overflow = 'hidden'` is set while the modal is open and
restored on unmount. The previous value is captured in a closure to avoid
stomping other components' scroll locks.

### 6. External resource loading (no issue found)

The component loads no external scripts, images, or fonts. All icons come from
`lucide-react` (bundled SVG; no network request at runtime).

## Summary table

| Vector | Status | Mitigation |
|--------|--------|------------|
| HTML injection via props | ✅ Mitigated | `sanitizeText()` strips tags |
| XSS via `dangerouslySetInnerHTML` | ✅ Clean | Not used |
| PII in analytics | ✅ Mitigated | Taxonomy allowlist + `sanitizeAnalyticsPayload` |
| Inline style / nonce requirement | ✅ Clean | Tailwind classes only |
| Eval / dynamic code | ✅ Clean | Not used |
| External resource fetch | ✅ Clean | None |

## No new dependencies

## Feature flag / rollout

No runtime flag needed. All mitigations are structural and active on every render.

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-031
- [x] `sanitizeText()` strips HTML tags from all string props
- [x] No `dangerouslySetInnerHTML` in the component
- [x] No PII fields in analytics payloads
- [x] No inline styles (CSP-safe)
- [x] No eval / new Function calls
- [x] Security tests pass (5 cases in `PurchaseModal.test.tsx`)
