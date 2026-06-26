# SW-FE-028 — Purchase Modal: Performance Budget (CLS / LCP)

Part of the **Stellar Wave** engineering batch.

## Problem

Two CLS sources were identified in the Purchase modal:

### 1. CLS — card collapses on loading → content transition

The `Card` had no reserved minimum height. When the loading spinner was replaced
by the real content (price + buttons) the card grew from `~80px` to `~220px`,
shifting everything below it on the page.

### 2. CLS — price string causes width/height reflow

The price value was a bare text node inside a `text-3xl` container. On slow
connections the price resolved after first paint, causing a height change inside
the card and a secondary layout shift.

## Changes

| File | Change |
|------|--------|
| `src/components/ui/purchase-modal.tsx` | Added `min-h-[260px]` to the `Card` wrapper — holds stable space for all states (loading, error, empty, normal). |
| `src/components/ui/purchase-modal.tsx` | Wrapped price text in `<div className="h-10 flex items-center justify-center">` — reserves exactly one line of `text-3xl` height before the price resolves. |
| `src/hooks/usePurchaseModalWebVitals.ts` | New hook — monitors CLS and LCP via `PerformanceObserver` while the modal is open; reports budget violations to `/api/v1/metrics` in production. |
| `test/PurchaseModal.test.tsx` | 3 new CLS/LCP regression tests (see below). |
| `test/usePurchaseModalWebVitals.test.ts` | 5 new hook safety tests. |

## No new dependencies

`PerformanceObserver` is a native browser API. No bundle budget exemption required.

## Feature flag / rollout

No runtime flag needed. Changes are purely structural (reserved dimensions, passive observer).

1. Deploy to preview.
2. Run Lighthouse or WebPageTest against `/shop` while opening the Purchase modal.
3. Confirm CLS score remains ≤ 0.1 across loading → content transitions.
4. Check `/api/v1/metrics` in staging to verify LCP reports arrive.
5. Promote to production.

**Rollback**: revert this single commit. No data migration.

## New tests

```
SW-FE-028 — CLS / LCP (performance budget)
  ✓ card always has min-h-[260px] class to prevent CLS on loading → content transition
  ✓ price slot has h-10 class for a stable height (no CLS from text reflow)
  ✓ loading state renders inside the same reserved-height card

usePurchaseModalWebVitals
  ✓ mounts without errors when isOpen is false
  ✓ mounts without errors when isOpen is true (no PerformanceObserver in jsdom)
  ✓ does not throw when PerformanceObserver is absent
  ✓ returns undefined (void hook)
  ✓ accepts custom budget config without error
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-028
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 3 new CLS regression cases
- [x] No new production dependencies
- [x] Card always occupies `min-h-[260px]` — zero CLS on state transitions
- [x] Price slot has `h-10` — no height reflow when price string resolves
