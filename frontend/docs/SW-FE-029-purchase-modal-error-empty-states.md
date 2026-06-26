# SW-FE-029 — Purchase Modal: Error & Empty States

Part of the **Stellar Wave** engineering batch.

## Problem

Three gaps in Purchase modal error and empty-state handling:

### 1. Error state had no icon or retry affordance

The error state rendered a bare red text string with only a "Close" button.
There was no visual indicator (icon) to help users quickly distinguish an error
from normal content, and no retry path — users had to close the modal and
restart the purchase flow.

### 2. Error state lacked screen-reader announcement

The error container had no `role="alert"` / `aria-live="assertive"`, so
screen-reader users were not notified when the error appeared.

### 3. Empty state had no Close button

When `itemName` was `null` or empty the modal showed an "Item details not
found." message with no way to dismiss it — users had to press Escape or click
the backdrop.

## Changes

| File | Change |
|------|--------|
| `src/components/ui/purchase-modal.tsx` | Error state now shows `AlertCircle` icon + coloured message + optional `Retry` button (visible when `onRetry` prop is provided) + `Close` button. Container has `role="alert"` and `aria-live="assertive"`. |
| `src/components/ui/purchase-modal.tsx` | Empty state now includes a `Close` button (`data-testid="purchase-modal-empty-close"`). |
| `src/components/ui/purchase-modal.tsx` | Loading state `aria-busy="true"` and the spinner has `role="status"` with a descriptive `aria-label`. |
| `test/PurchaseModal.test.tsx` | 9 new error/empty-state tests (see below). |

### New `onRetry` prop

```tsx
<PurchaseModal
  isOpen={isOpen}
  onClose={handleClose}
  onConfirm={handleConfirm}
  onRetry={handleRetry}   // optional — shows Retry button when provided
  error={purchaseError}
  itemName={item.name}
  itemPrice={item.price}
  itemCurrency={item.currency}
/>
```

## No new dependencies

`AlertCircle` and `RefreshCw` are already bundled via `lucide-react`.

## Feature flag / rollout

No runtime flag needed. Changes are additive UI only.

1. Deploy to preview.
2. Trigger an error response from the purchases API — confirm AlertCircle + message + Retry button appear.
3. Click Retry — confirm `onRetry` callback fires without closing the modal.
4. Open modal with `itemName={null}` — confirm "Item details not found." + Close button appear.
5. Confirm all interactions are announced by a screen reader.

**Rollback**: revert this single commit. No data migration.

## New tests

```
SW-FE-029 — error and empty states
  ✓ shows loading indicator with aria-busy when isLoading is true
  ✓ shows error message with AlertCircle when error is supplied
  ✓ error state has role="alert" for screen readers
  ✓ shows Retry button in error state when onRetry is provided
  ✓ does not show Retry button in error state when onRetry is not provided
  ✓ shows Close button in error state
  ✓ shows empty state when itemName is null
  ✓ shows empty state when itemName is empty string
  ✓ empty state has a Close button
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-029
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 9 new error/empty-state cases
- [x] Error state shows `AlertCircle` + actionable message + optional Retry
- [x] Error container has `role="alert"` + `aria-live="assertive"`
- [x] Empty state has a Close button
- [x] Loading state has `aria-busy="true"` and spinner has `role="status"`
