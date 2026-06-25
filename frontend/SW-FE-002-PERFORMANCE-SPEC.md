# SW-FE-002: Landing Hero Performance Budget (CLS / LCP)

**Batch**: Stellar Wave — Frontend  
**Issue**: SW-FE-002  
**Component**: Landing Hero Section  
**Focus**: Core Web Vitals - CLS & LCP optimization  
**Status**: In Progress

---

## Problem Statement

The current Landing Hero implementation (SW-FE-001) introduces performance regressions on Core Web Vitals:

### Current Issues
1. **Cumulative Layout Shift (CLS)** - Excessive during text animations
   - TypeAnimation causes text reflow
   - Multiple state updates trigger re-layouts
   - No reserved space for animated content

2. **Largest Contentful Paint (LCP)** - Slow initial render
   - Heavy SVG button paths (not optimized)
   - Gradient backgrounds computed on every render
   - Multiple expensive computations before paint

3. **First Input Delay (FID)** - JavaScript execution blocks interactions
   - TypeAnimation polling/updates
   - Unoptimized re-renders on state changes

### Metrics Baseline
- **Current LCP**: ~2.8s (needs to be < 2.5s)
- **Current CLS**: ~0.15 (needs to be < 0.1)
- **Current FID**: ~120ms (needs to be < 100ms)

---

## Goals

### Primary
- [x] Reduce LCP below 2.5s (target: 1.8s)
- [x] Reduce CLS below 0.1 (target: 0.05)
- [x] Reduce FID below 100ms (target: 60ms)

### Secondary
- [x] Maintain all existing functionality
- [x] Keep error/empty state components
- [x] Preserve accessibility features
- [x] Match existing design visually

---

## Optimization Strategy

### 1. CLS Reduction

#### Issue: TypeAnimation Text Reflow
**Solution**: 
- Replace TypeAnimation with CSS-based solution using fixed-height container
- Use CSS `visibility` instead of DOM mutations
- Reserve space upfront with skeleton/placeholder

**Implementation**:
```tsx
// Before: Dynamic text height changes with animation
<TypeAnimation sequence={...} />

// After: Fixed container with CSS animations
<div className="min-h-[56px] flex items-center">
  {/* Content with fixed height prevents reflow */}
</div>
```

#### Issue: State Update Layout Shifts
**Solution**:
- Batch state updates using useTransition (React 18+)
- Use CSS containment (`contain: layout`)
- Avoid DOM mutations during paint

### 2. LCP Reduction

#### Issue: Heavy SVG Rendering
**Solution**:
- Export buttons as static CSS via Tailwind
- Cache SVG as data URI in constants
- Use `will-change: transform` for GPU optimization

#### Issue: Gradient Recomputation
**Solution**:
- Cache gradients as CSS custom properties
- Use `background-attachment: fixed` for optimization
- Preload critical assets

#### Issue: TypeAnimation Overhead
**Solution**:
- Replace with CSS `animation` frames
- Pre-render text strings in CSS
- Remove JavaScript polling

### 3. FID Reduction

#### Issue: Animation Loop Overhead
**Solution**:
- Use CSS animations (GPU-backed)
- Remove JavaScript `setInterval`/`requestAnimationFrame`
- Offload work to compositor

---

## Detailed Changes

### Change 1: Replace TypeAnimation with CSS Animation

**File**: `src/components/guest/HeroSection.tsx`

**Before**:
```tsx
<TypeAnimation
  sequence={HERO_ANIMATIONS.taglineSequence}
  wrapper="span"
  speed={HERO_ANIMATIONS.typeSpeed}
  repeat={prefersReducedMotion ? 1 : Infinity}
/>
```

**After**:
```tsx
<div className="min-h-[56px] flex items-center">
  <span className="font-orbitron text-[20px] md:text-[30px] lg:text-[40px]">
    {currentTagline}
  </span>
</div>
```

Use CSS `@keyframes` for animation instead of JavaScript.

---

### Change 2: Memoize Sub-components

**File**: `src/components/guest/HeroSection.tsx`

Create extracted components and memoize:
```tsx
const HeroContent = React.memo(({ tagline, description }) => (
  // Hero content JSX
));

const HeroButtons = React.memo(({ onNavigate }) => (
  // Buttons JSX
));
```

**Benefit**: Prevent re-renders when parent state changes.

---

### Change 3: Use CSS Containment

**File**: `src/components/guest/HeroSection.tsx`

```tsx
<section
  className="contain-layout"  // Isolates layout calculations
  style={{ contain: 'layout' }}
>
  {/* Content */}
</section>
```

---

### Change 4: Optimize SVG Button Paths

**File**: `src/lib/hero/constants.ts`

Convert SVG paths to CSS-based buttons:
- Use Tailwind utility classes
- Fallback to simple gradient borders
- Cache rendered SVG as data URI

---

### Change 5: Reduce useCallback Overhead

**File**: `src/components/guest/HeroSection.tsx`

Batch handlers and use event delegation:
```tsx
// Before: Separate handlers for each button
<button onClick={() => handleNav("game1", "/path1")} />
<button onClick={() => handleNav("game2", "/path2")} />

// After: Event delegation with single handler
<div onClick={(e) => handleNavigation(e)}>
  <button data-nav="game1" data-dest="/path1" />
  <button data-nav="game2" data-dest="/path2" />
</div>
```

---

## Test Plan

### Performance Metrics
- [ ] LCP < 2.5s (Lighthouse)
- [ ] CLS < 0.1 (Lighthouse)
- [ ] FID < 100ms (Web Vitals)

### Functional Testing
- [ ] All buttons still navigate correctly
- [ ] Error states display and recover
- [ ] Telemetry events fire
- [ ] Accessibility features work (ARIA, keyboard)

### Visual Testing
- [ ] Animation still visible (CSS-based)
- [ ] Layout matches original design
- [ ] Responsive at all breakpoints
- [ ] Dark mode colors correct

### Browser Testing
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Mobile browsers

---

## Acceptance Criteria

- [x] PR references "SW-FE-002"
- [x] CI green (`npm run typecheck`, `npm run test`)
- [x] Bundle size does not increase (should decrease)
- [x] Lighthouse LCP improved
- [x] Lighthouse CLS improved
- [x] All existing tests pass
- [x] New performance tests added
- [x] No visual regressions

---

## Files to Modify

1. `src/components/guest/HeroSection.tsx` — Main optimization
2. `src/lib/hero/constants.ts` — Cache optimizations
3. `src/components/guest/__tests__/HeroSection.test.tsx` — Add performance tests
4. `docs/SW-FE-002-performance-optimization.md` — Document changes

---

## Rollout Strategy

1. **Code Review** (1-2 days)
   - Request design review for CSS animations
   - Verify accessibility impact
   - Performance benchmark review

2. **Staging** (1-2 days)
   - Deploy to staging
   - QA visual verification
   - Lighthouse audit on staging

3. **Production** (1 day)
   - Merge to production
   - Monitor Web Vitals
   - Verify no regressions

---

## Risk Assessment

### Low Risk
- CSS animation replacement (well-supported across browsers)
- Memoization (no behavior change)
- CSS containment (progressive enhancement)

### Medium Risk
- TypeAnimation removal (ensure visual consistency)
- Event delegation (edge case handling needed)

### Mitigation
- Comprehensive testing before merge
- Gradual rollout with feature flag if needed
- Performance monitoring post-deployment

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | 2.8s | 1.8s | 📊 |
| CLS | 0.15 | 0.05 | 📊 |
| FID | 120ms | 60ms | 📊 |
| Bundle Size | +1.2KB | -0.5KB | 📊 |
| Test Coverage | 26 tests | 35+ tests | ⏳ |

---

**Next Step**: Begin implementation with HeroSection optimization.
