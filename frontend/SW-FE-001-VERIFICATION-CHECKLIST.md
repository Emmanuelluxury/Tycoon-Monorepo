# SW-FE-001: Verification Checklist

## Pre-Merge Verification

Use this checklist to verify all changes are working correctly before merging.

---

## ✅ Automated Testing

### Run All Tests
```bash
npm run test
```
**Expected:** All tests pass, including 40+ new a11y tests

### Run Specific A11Y Tests Only
```bash
npm run test -- test/HeroSection.a11y-focus-order.test.tsx
```
**Expected:** 40+ tests passing

### Run Type Checking
```bash
npm run typecheck
```
**Expected:** Zero TypeScript errors

### Run Linting
```bash
npm run lint
```
**Expected:** No errors or warnings

### Build Check
```bash
npm run build
```
**Expected:** Build succeeds, no warnings

---

## ✅ Manual Testing — Keyboard Navigation

### Tab Navigation
- [ ] Click in browser address bar (move focus away from page)
- [ ] Press `Tab` → Focus moves to "Continue Game" button (cyan ring visible)
- [ ] Press `Tab` → Focus moves to "Multiplayer" button
- [ ] Press `Tab` → Focus moves to "Join Room" button
- [ ] Press `Tab` → Focus moves to "Challenge AI" button
- [ ] Press `Tab` → Focus moves to next page element

**Expected:** 
- Cyan focus ring visible on each button
- Ring is 2px wide with dark offset
- Tab order is logical (top to bottom)

### Reverse Navigation
- [ ] Click in browser address bar
- [ ] Press `Tab` → Focus to "Continue Game" button
- [ ] Press `Tab` → Focus to "Multiplayer" button
- [ ] Press `Shift+Tab` → Focus back to "Continue Game" button
- [ ] Press `Shift+Tab` → Focus moves to previous page element

**Expected:**
- Shift+Tab works in reverse order
- Focus ring appears/disappears consistently

### Activation
- [ ] Focus "Continue Game" button with Tab
- [ ] Press `Enter` → Button activates, navigates to /game-settings
- [ ] Go back to hero
- [ ] Focus any button with Tab
- [ ] Press `Space` → Button activates

**Expected:**
- Both Enter and Space activate buttons
- Navigation works as expected
- No console errors

---

## ✅ Manual Testing — Screen Reader (VoiceOver on macOS)

### Enable VoiceOver
```
Cmd+F5  # Toggle VoiceOver on/off
```

### Test Announcement
- [ ] Go to landing page
- [ ] Enable VoiceOver
- [ ] Listen for: "Hero section loaded. Use Tab to navigate through game options."

**Expected:**
- Announcement plays on page load
- Only plays once (no repeats)
- Clear and understandable

### Test Button Navigation
- [ ] With VoiceOver on, press Tab
- [ ] Listen for: "[Button Name] button"
- [ ] Examples: "Continue game button", "Multiplayer button", etc.

**Expected:**
- Each button announces its name
- All 4 buttons are announced
- No duplicate announcements

### Test Decorative Elements
- [ ] Use VoiceOver rotor to navigate
- [ ] Verify decorative elements (SVGs, background) are not announced

**Expected:**
- Only buttons and meaningful content announced
- No "image" or "SVG" announcements for decorative elements

---

## ✅ Manual Testing — Screen Reader (NVDA on Windows)

### Install and Enable NVDA
1. Download from https://www.nvaccess.org
2. Click "Ctrl+Alt+N" to start NVDA

### Test Announcement
- [ ] Go to landing page
- [ ] Listen for hero section announcement

**Expected:**
- "Hero section loaded" announcement heard
- Instructions provided about Tab key

### Test Navigation
- [ ] Press Tab with NVDA running
- [ ] Listen for button announcements

**Expected:**
- Button names clearly announced
- All 4 CTA buttons announced

---

## ✅ Manual Testing — Mobile (iOS)

### Enable VoiceOver
- Settings → Accessibility → VoiceOver → On

### Test Touch Navigation
- [ ] With VoiceOver on, single tap on buttons
- [ ] Swipe right to navigate between buttons
- [ ] Double tap to activate

**Expected:**
- Buttons announced on tap
- Focus ring visible on tap/swipe
- Activation works with double tap

---

## ✅ Manual Testing — Mobile (Android)

### Enable TalkBack
- Settings → Accessibility → TalkBack → On

### Test Navigation
- [ ] With TalkBack on, explore by touch
- [ ] Buttons announce as you explore
- [ ] Double tap to activate

**Expected:**
- TalkBack announces buttons
- Focus indicators work
- Activation works

---

## ✅ Browser Testing

### Chrome/Edge (Windows/Mac)
- [ ] Tab navigation works
- [ ] Focus ring visible
- [ ] All tests passing
- [ ] Build successful

### Firefox (Windows/Mac)
- [ ] Tab navigation works
- [ ] Focus ring visible
- [ ] All tests passing

### Safari (Mac)
- [ ] Tab navigation works
- [ ] Focus ring visible
- [ ] All tests passing
- [ ] VoiceOver announces correctly

### Mobile Chrome (Android)
- [ ] Tab navigation works on keyboard
- [ ] Touch navigation works

### Mobile Safari (iOS)
- [ ] Tab navigation works on keyboard
- [ ] Touch navigation works
- [ ] VoiceOver works

---

## ✅ File Changes Verification

### Check Modified Files
```bash
git diff frontend/src/components/guest/HeroSection.tsx
git diff frontend/src/components/guest/HeroSectionMobile.tsx
git diff frontend/src/app/globals.css
```

**Expected:**
- Focus styles added to buttons
- Screen reader announcement useEffect added
- sr-only utility added to CSS

### Check New Test File
```bash
ls -la frontend/test/HeroSection.a11y-focus-order.test.tsx
```

**Expected:**
- File exists
- ~480 lines of test code
- 40+ test cases

---

## ✅ Bundle Size Check

### Before PR
```bash
npm run bundle:check > /tmp/before.json
```

### After PR
```bash
npm run build
npm run bundle:check > /tmp/after.json
```

### Compare
```bash
diff /tmp/before.json /tmp/after.json
```

**Expected:**
- No increase in bundle size
- CSS unchanged (Tailwind processing)
- JavaScript unchanged (only type annotations)

---

## ✅ Lighthouse Accessibility Score

### Run Lighthouse
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Accessibility"
4. Click "Analyze page load"

**Expected:**
- Score: 90+ (target: 100)
- No issues with buttons
- No contrast issues
- No focus order issues

---

## ✅ Code Quality

### TypeScript Strict Mode
```bash
npm run typecheck
```
**Expected:** ✅ Pass (0 errors)

### ESLint
```bash
npm run lint
```
**Expected:** ✅ Pass (0 errors)

### Tests
```bash
npm run test
```
**Expected:** ✅ Pass (all tests)

### Build
```bash
npm run build
```
**Expected:** ✅ Success (no warnings)

---

## ✅ Edge Cases

### Reduced Motion Preference
- [ ] System Preferences → Accessibility → Display → Reduce motion (Mac)
- [ ] Settings → Accessibility → Display → Remove animations (Windows)
- [ ] Reload page
- [ ] Animations should be disabled
- [ ] Focus ring should still work

**Expected:**
- Animations disabled (animation-pulse removed)
- Focus ring still visible
- Navigation still works

### Error State
- [ ] Mock a navigation error (trigger error handling)
- [ ] Focus "Try Again" button
- [ ] Verify it's focusable and activatable

**Expected:**
- Focus ring appears on "Try Again" button
- Button is activatable with Enter/Space
- Error message remains accessible

### SSR (Server-Side Rendering)
- [ ] Build project
- [ ] No hydration errors
- [ ] Page renders correctly

**Expected:**
- No console errors
- Page loads successfully
- Keyboard navigation works

---

## ✅ Responsive Design

### Desktop (1920px)
- [ ] Focus ring visible
- [ ] All buttons keyboard accessible
- [ ] Tab order correct

### Tablet (768px)
- [ ] Focus ring visible
- [ ] HeroSectionMobile renders
- [ ] Keyboard accessible

### Mobile (375px)
- [ ] Focus ring visible
- [ ] All buttons accessible
- [ ] Touch navigation works

---

## ✅ Git Verification

### Check Commit Message
```bash
git log -1 --format=%B
```

**Expected:**
- Starts with "SW-FE-001"
- References issue number
- Clear description

### Check Files Changed
```bash
git diff --name-only
```

**Expected:**
- `frontend/src/components/guest/HeroSection.tsx`
- `frontend/src/components/guest/HeroSectionMobile.tsx`
- `frontend/src/app/globals.css`
- `frontend/test/HeroSection.a11y-focus-order.test.tsx`
- Documentation files (optional)

### Check Line Changes
```bash
git diff --stat
```

**Expected:**
- HeroSection.tsx: ~+15 lines
- HeroSectionMobile.tsx: ~+18 lines
- globals.css: ~+11 lines
- Test file: ~+480 lines
- Total: ~524 lines added

---

## ✅ Documentation

- [ ] PR body complete with all sections
- [ ] Acceptance criteria documented
- [ ] Testing instructions included
- [ ] Files changed clearly listed
- [ ] Browser support documented
- [ ] WCAG compliance verified

---

## ✅ Final Checklist

Before merging:

- [ ] All automated tests pass (`npm run test`)
- [ ] TypeScript strict mode passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] No bundle size increase
- [ ] Manual keyboard navigation tested
- [ ] Manual screen reader testing done
- [ ] Mobile keyboard navigation works
- [ ] Edge cases verified
- [ ] All responsive breakpoints tested
- [ ] Git commit message follows convention
- [ ] PR description complete
- [ ] WCAG 2.1 Level AA verified
- [ ] No breaking changes
- [ ] No new dependencies
- [ ] Code review approved
- [ ] All CI checks passing

---

## Sign-Off

**When ready to merge:**

1. ✅ Run full test suite: `npm run test`
2. ✅ Run type check: `npm run typecheck`
3. ✅ Run build: `npm run build`
4. ✅ Verify no bundle growth
5. ✅ Manual testing complete
6. ✅ All checks passing
7. ✅ Ready for merge

**Reviewer Sign-Off:**

- Reviewed code changes: _____ ✅
- Verified tests passing: _____ ✅
- Tested keyboard navigation: _____ ✅
- Tested screen reader: _____ ✅
- Approved for merge: _____ ✅

---

**Status: Ready for Merge** 🚀
