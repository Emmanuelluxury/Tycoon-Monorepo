# SW-FE-001 — Landing Hero: Privacy-Safe Telemetry Hooks

## Overview

This PR implements privacy-safe telemetry hooks for the landing hero section on Next.js frontend. The telemetry system tracks user interactions (view, CTA clicks, errors) without collecting any PII or external dependencies.

**Part of:** Stellar Wave engineering batch (FE track)
**Issue:** SW-FE-001
**Type:** Feature + Security Hardening

---

## Scope

### In Scope
- Enhance `useHeroTelemetry` hook with structured event types and error tracking
- Add `fireError()` callback for error telemetry
- Update `HeroSection` component to track:
  - `hero_view` — page load
  - `hero_cta_click` — any CTA button click
  - `hero_error_displayed` — navigation errors with error type
- Add comprehensive unit tests for telemetry and component behavior
- Maintain CSP compliance and privacy standards
- Document rollout and monitoring

### Out of Scope
- Runtime feature flags (use staged rollout instead)
- External analytics SDK integration
- Cookie/consent mechanisms (telemetry is server-side only, no client tracking)
- Changes to other components

---

## Technical Changes

### 1. Enhanced `useHeroTelemetry` Hook

**File:** `src/hooks/useHeroTelemetry.ts`

**Key Changes:**
- Added `HeroEventName` type with all valid event names (5 → 6 events)
- Extended `HeroTelemetryEvent` interface with optional `errorType` field
- New `fireError(errorType)` callback for error tracking
- Improved documentation with privacy design principles

**New Event Types:**
```typescript
type HeroEventName =
  | "hero_view"           // Page load (fired once per session)
  | "hero_cta_click"      // Any CTA button clicked
  | "hero_join_room_click" // Join room button (future dedicated tracking)
  | "hero_challenge_ai_click" // Challenge AI button (future dedicated tracking)
  | "hero_multiplayer_click" // Multiplayer button (future dedicated tracking)
  | "hero_error_displayed" // Error occurred (with errorType metadata)
```

**Error Types:**
```typescript
type ErrorType = 
  | "navigation_error"      // General navigation failure
  | "rate_limit_exceeded"   // Rate limiting triggered
  | "validation_failed"     // Input validation error
```

### 2. Updated `HeroSection` Component

**File:** `src/components/guest/HeroSection.tsx`

**Changes:**
- Extract `fireError` from `useHeroTelemetry()` hook
- Track `hero_cta_click` before navigation (not individual button events)
- Call `fireError(errorType)` when navigation fails
- Fire `hero_view` again on error recovery (Try Again button)

**Event Flow:**
```
User Loads Page
  ↓
fire("hero_view")
  ↓
User Clicks CTA Button
  ↓
fire("hero_cta_click")
navigateSafely() // validates & executes
  ├─ Success → navigation occurs
  └─ Failure → fireError(errorType)
```

### 3. Unit Tests

**New Files:**
- `src/hooks/useHeroTelemetry.spec.ts` (250+ lines)
- `src/components/guest/HeroSection.spec.tsx` (250+ lines)

**Test Coverage:**
- Telemetry disabled when flag is off ✓
- Custom events dispatched with correct structure ✓
- Elapsed time calculated and rounded ✓
- Error events include error type ✓
- Hook callbacks remain stable across re-renders ✓
- Hero view fires once on mount ✓
- CTA clicks trigger telemetry before navigation ✓
- Errors tracked with correct type ✓
- Error recovery fires hero_view again ✓
- Accessibility: single h1, aria-labels, alert role ✓
- No PII in payloads ✓

---

## Privacy & Security

### Privacy Guarantees
- **No PII:** No user IDs, emails, IPs, wallet addresses
- **No wall-clock timestamps:** Uses elapsed time (ms since page load) only
- **No external SDKs:** Events dispatched via `CustomEvent` on `window` for first-party collection
- **No cookies/fingerprinting:** Telemetry flag-gated and server-side collection only
- **SSR-safe:** Returns early if `window` is undefined (server-side)

### CSP Compliance
- No inline script injection
- No external script sources
- No data exfiltration
- Adheres to existing CSP policy in `next.config.ts`

### Validation & Sanitization
- All event names are string-literal typed (prevents typos)
- Error types are enum-like (validated set)
- Navigation destinations already validated in `useHeroNavigation`
- No dynamic event name construction

---

## Rollout Plan

### Phase 1: Deploy (Current)
1. PR review and approval
2. CI green: `npm run typecheck`, `npm run test`
3. Merge to `main`
4. Deploy to preview environment

### Phase 2: Monitoring (1 week)
1. Verify telemetry events are being dispatched (check browser DevTools)
2. Monitor for any CSP violations or errors in console
3. Compare Core Web Vitals (LCP, CLS) vs baseline
4. Check error rates (look for spike in `hero_error_displayed` events)

### Phase 3: Rollout (Staged)
1. Deploy to canary/internal environment first
2. If no issues → deploy to 10% of production
3. Monitor for 24 hours
4. If no issues → ramp to 100%
5. If issues → rollback (revert this PR)

### Rollback Plan
If issues occur during rollout:
```bash
git revert <commit-hash>
npm run build
npm run start
```

---

## Testing Instructions

### Unit Tests
```bash
cd frontend
npm run test -- --run useHeroTelemetry.spec.ts HeroSection.spec.tsx
```

### Type Checking
```bash
npm run typecheck
```

### Bundle Impact
```bash
npm run bundle:check
```
Expected delta: **~0 bytes** (no new dependencies)

### Manual QA

**Desktop:**
1. Open home page in Chrome DevTools
2. Paste in console:
   ```javascript
   window.__heroTelemetry = [];
   window.addEventListener('tycoon:telemetry', e => {
     window.__heroTelemetry.push(e.detail);
     console.log('Telemetry:', e.detail);
   });
   ```
3. Verify `hero_view` event fires
4. Click each CTA button, verify `hero_cta_click` fires
5. Trigger error (rate limit by rapid clicking), verify `hero_error_displayed` fires

**Mobile:**
1. Same as desktop on iOS Safari and Chrome Android
2. Verify touch interactions work correctly

### Accessibility
1. Run `axe DevTools` or `Lighthouse` audit
2. Verify only one `<h1>` on page
3. Verify all buttons have `aria-label`
4. Verify decorative elements have `aria-hidden="true"`
5. Test with screen reader (NVDA, JAWS, VoiceOver)

---

## Migration Notes

### For Developers
- No breaking changes to existing hooks
- `useHeroTelemetry()` now returns `{ fire, fireError }` instead of `{ fire }`
- All new events are backward compatible

### For Infrastructure
- No database schema changes
- No API endpoint changes
- Telemetry events continue to be dispatched via `window` event
- First-party collector (if exists) can listen to `tycoon:telemetry` events

### For Product/Analytics
- New event types available:
  - `hero_error_displayed` with `errorType` metadata
- Elapsed time allows measuring interaction timing
- Events are first-party only (no third-party tracking)

---

## Verification Checklist

- [x] PR title references Stellar Wave and issue ID (SW-FE-001)
- [x] No external analytics SDKs added
- [x] No PII in telemetry payloads
- [x] Tests added for telemetry hook and component
- [x] `npm run typecheck` passes
- [x] `npm run test` passes (unit tests green)
- [x] CSP compliance verified (no new violations)
- [x] Accessibility maintained (single h1, aria-labels)
- [x] Bundle size impact: 0 bytes (no new deps)
- [x] Error handling graceful (no unhandled rejections)
- [x] SSR-safe (window checks in place)
- [x] Documentation complete (this file)

---

## Monitoring & Metrics

### Key Metrics to Track (Post-Deployment)
1. **Event Volume:** `hero_view` events per session (baseline ~1)
2. **Error Rate:** % of sessions with `hero_error_displayed` (expect < 1%)
3. **Error Types:** Breakdown of `rate_limit_exceeded` vs `validation_failed`
4. **Core Web Vitals:** LCP and CLS vs previous week (expect no regression)
5. **Navigation Success:** % of CTA clicks resulting in successful navigation

### Alerts to Configure
- `hero_error_displayed` event volume > 5% of `hero_view` events (investigate)
- LCP regression > 100ms (investigate)
- CLS regression > 0.1 (investigate)

---

## Future Enhancements

### Not in Scope for This PR
- [ ] Add `hero_join_room_click` dedicated tracking (currently generic `hero_cta_click`)
- [ ] Add `hero_multiplayer_click` dedicated tracking
- [ ] Add session ID tracking (requires privacy review)
- [ ] Add A/B test variant tracking (requires feature flag)
- [ ] Server-side telemetry collection endpoint (`/api/telemetry`)

---

## Questions & Support

For questions about:
- **Telemetry Design:** See `src/hooks/useHeroTelemetry.ts` comments
- **Privacy Guarantees:** See CSP_DOCUMENTATION.md
- **Testing:** See unit test files
- **Rollout:** See Phase 1-3 above

---

## Related Issues & Documents

- **Backend:** `docs/SW-BE-007-redis-dto-validation-error-mapping.md` (related error handling)
- **Security:** `CSP_DOCUMENTATION.md` (CSP compliance)
- **Previous:** `docs/SW-FE-001-landing-hero-rollout.md` (accessibility changes)
- **Security Hardening:** `docs/SW-FE-007-landing-hero-security-hardening.md`
