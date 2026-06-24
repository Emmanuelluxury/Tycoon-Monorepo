# SW-FE-001: Landing Hero — TypeScript Strictness and Null Guards

**PR Title:** `SW-FE-001: Improve Landing Hero TypeScript Strictness and Null Guards`

**Related Issue:** SW-FE-001

**Part of:** Stellar Wave — Frontend Batch

---

## Summary

Enhanced TypeScript strictness and null safety in the landing hero components (`HeroSection.tsx` and `HeroSectionMobile.tsx`). All changes follow existing Next.js and Tailwind patterns with zero new dependencies added.

---

## Changes Made

### 1. HeroSection.tsx

#### Type Safety Improvements
- **Return Type Annotation**: Added explicit `React.ReactElement` return type to component function
  ```tsx
  const HeroSection: React.FC<HeroSectionProps> = ({ className }): React.ReactElement => {
  ```
  
- **Props Interface Strictness**: Clarified optional className with explicit `undefined`
  ```tsx
  interface HeroSectionProps {
    className?: string | undefined;
  }
  ```

- **Error Catch Block Typing**: Added proper `unknown` type for catch block with explicit null checks
  ```tsx
  catch (err: unknown) {
    const sanitized = sanitizeError(err);
    if (sanitized !== null) {  // Explicit null check
      setError({ 
        hasError: true, 
        message: sanitized.userMessage ?? "An unexpected error occurred"  // Nullish coalescing
      });
    }
  }
  ```

- **Nullish Coalescing Operator**: Replaced `||` with `??` for className to properly handle empty strings
  ```tsx
  className={`... ${className ?? ""}`}
  ```

- **Event Listener Typing**: Enhanced `usePrefersReducedMotion` hook with proper event types
  ```tsx
  const onChange = (event: MediaQueryListEvent): void => {
    setReduced(event.matches);
  };
  ```

- **Defensive matchMedia Check**: Added null guard for matchMedia return value
  ```tsx
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!mq) {
    return;
  }
  ```

- **Callback Return Type**: Made `handleTrackedNavigation` return type explicit as `void`
  ```tsx
  (event: "continue_game_click" | ..., destination: string): void => {
  ```

### 2. HeroSectionMobile.tsx

#### Consistent Type Safety Updates
- **Props Interface**: Applied same strictness pattern
  ```tsx
  interface HeroSectionMobileProps {
    className?: string | undefined;
  }
  ```

- **Return Type**: Added explicit `React.ReactElement` return type

- **Nullish Coalescing**: Updated className handling
  ```tsx
  className={`... ${className ?? ""}`}
  ```

- **Enhanced usePrefersReducedMotion**: Applied same defensive null guards and typing
  - Added null check for matchMedia result
  - Proper typing for MediaQueryListEvent
  - Cleanup listener with proper typing

---

## Test Coverage Added

### New Test File: `test/HeroSection.null-guards.test.tsx`

Comprehensive test suite for null safety scenarios:

#### Test Categories
1. **Null Safety in Error Handling** (4 tests)
   - Handles `sanitizeError` returning null gracefully
   - Safely accesses sanitized error message properties
   - Uses fallback message when userMessage is undefined
   - Properly types error parameter in catch block

2. **Null Coalescing Operator Usage** (4 tests)
   - Handles undefined className
   - Handles null className
   - Handles empty string className
   - Respects provided className values

3. **usePrefersReducedMotion Null Guards** (5 tests)
   - Handles window being undefined (SSR)
   - Handles matchMedia returning null/undefined
   - Properly types matchMedia event listener
   - Cleans up listeners with proper typing
   - Verifies cleanup on unmount

4. **HeroSectionMobile Null Guards** (4 tests)
   - Handles undefined className
   - Applies custom className correctly
   - Uses nullish coalescing
   - Has same reduced motion guards as desktop

5. **Type Strictness in Callbacks** (2 tests)
   - handleTrackedNavigation returns void explicitly
   - Callback properly types event parameter as union

6. **Props Interface Strictness** (3 tests)
   - Props require optional className type
   - Allows className as undefined
   - Enforces className type in mobile props

7. **Error State Interface Strictness** (1 test)
   - Error state has proper interface with hasError and message

**Total Tests Added:** 23 comprehensive tests for null safety and type strictness

---

## Verification

✅ **TypeScript Strict Mode**: All code passes strict type checking  
✅ **No Diagnostics**: Zero TypeScript errors or warnings in affected files  
✅ **No New Dependencies**: Zero new npm packages added  
✅ **Pattern Consistency**: All changes follow existing codebase conventions  
✅ **Accessibility Preserved**: All aria-labels, aria-live, and role attributes maintained  
✅ **Test Coverage**: Comprehensive test suite for null guard scenarios  

---

## Testing Instructions

### Run TypeScript Type Check
```bash
npm run typecheck
```

### Run New Null Guard Tests
```bash
npm run test -- test/HeroSection.null-guards.test.tsx
```

### Run All Tests
```bash
npm run test
```

### Build Check
```bash
npm run build
```

---

## Bundle Impact

✅ **Zero Bundle Impact**: No new dependencies or code patterns that affect bundle size

---

## Acceptance Criteria

- [x] PR references Stellar Wave (SW-FE-001)
- [x] CI passes for frontend package
- [x] `npm run typecheck` passes
- [x] `npm run test` passes for new null guard tests
- [x] UI behavior unchanged (only type safety improved)
- [x] All existing tests continue to pass
- [x] No new heavy client dependencies added
- [x] Changes match Next.js/Tailwind patterns

---

## Migration / Rollout Notes

No migration needed. This is a purely internal type safety improvement with:
- Zero runtime behavioral changes
- Zero breaking changes
- Zero new dependencies
- Backwards compatible with all existing code

Changes are safe to deploy immediately without feature flags or gradual rollout.

---

## Files Modified

1. `Tycoon-Monorepo/frontend/src/components/guest/HeroSection.tsx` — Enhanced type safety
2. `Tycoon-Monorepo/frontend/src/components/guest/HeroSectionMobile.tsx` — Enhanced type safety
3. `Tycoon-Monorepo/frontend/test/HeroSection.null-guards.test.tsx` — NEW: Comprehensive null guard tests

---

## Technical Details

### Changes Summary

| Area | Before | After | Benefit |
|------|--------|-------|---------|
| Return Type | Implicit | `React.ReactElement` | Explicit contract |
| Error Handling | `err: any` | `err: unknown` | Type safe errors |
| Null Check | Truthy check | `!== null` | Explicit null safety |
| Optional Fallback | `\|\|` | `??` | Handles empty strings |
| Event Listeners | Untyped callback | `MediaQueryListEvent` | Type safe events |
| Props | `string?` | `string \| undefined` | Explicit optional |

### Why These Changes Matter

1. **Explicit Null Checking**: Using `?? "fallback"` instead of `\|\| "fallback"` ensures empty strings are preserved (important for className)
2. **Proper Error Typing**: `unknown` type in catch blocks forces explicit type narrowing, catching potential bugs
3. **Event Listener Typing**: `MediaQueryListEvent` type ensures callbacks handle the correct event structure
4. **Return Type Clarity**: Explicit `React.ReactElement` makes component contracts clear to TypeScript
5. **matchMedia Null Guard**: Defensive programming for edge cases where matchMedia might fail

---

## References

- TypeScript Handbook: [Type Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- React TypeScript: [Component Props](https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/function_components/)
- MDN: [MediaQueryList](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList)
