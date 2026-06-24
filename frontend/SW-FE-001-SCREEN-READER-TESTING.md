# SW-FE-001: Screen Reader Testing Guide

This guide provides detailed instructions for testing the accessibility improvements with various screen readers.

---

## Overview

The hero section implements:
- Screen reader announcement on load
- Accessible button names
- Hidden decorative elements
- Proper semantic HTML
- ARIA live regions for animations

---

## VoiceOver (macOS/iOS)

### Enable VoiceOver

**macOS:**
```
Cmd+F5  # Toggle VoiceOver
```

**iOS:**
1. Settings → Accessibility → VoiceOver → On
2. Done

### Basic Navigation

| Key | Action |
|-----|--------|
| `VO+Right Arrow` | Next item |
| `VO+Left Arrow` | Previous item |
| `VO+Space` | Interact / click |
| `VO+U` | Rotor (menu) |
| `Tab` | Next item (Safari only) |

Where `VO` = Control + Option

### Test Sequence

#### 1. Page Load Announcement
```
Expected announcement: "Hero section loaded. Use Tab to navigate through game options."
Timing: Should hear immediately when page loads
Frequency: Only once (not repeated)
```

#### 2. Navigate to Buttons
```
Steps:
1. Press VO+Right Arrow multiple times
2. Listen for each button announcement

Expected sequence:
- "Continue game button"
- "Multiplayer button"
- "Join room button"
- "Challenge AI button"
```

#### 3. Activate Buttons
```
With button focused:
1. Press VO+Space to interact
2. Should activate button (navigate to new page)
```

#### 4. Verify Decorative Elements Hidden
```
Using rotor (VO+U):
1. Open rotor
2. Navigate to see all elements
3. Verify no SVGs, backgrounds, or decorative elements listed
```

### Common Issues & Solutions

**Issue:** Announcement not heard
- Solution: Ensure sound is on, refresh page

**Issue:** Button names not announced
- Solution: Verify aria-label attributes exist

**Issue:** Decorative elements announced
- Solution: Check aria-hidden="true" on SVGs

---

## NVDA (Windows)

### Installation

1. Download: https://www.nvaccess.org
2. Run installer
3. Follow setup wizard

### Enable NVDA

```
Ctrl+Alt+N  # Start NVDA
Ctrl+Alt+N  # Stop NVDA (again)
```

Or click NVDA desktop icon.

### Basic Navigation

| Key | Action |
|-----|--------|
| `Down Arrow` | Next item |
| `Up Arrow` | Previous item |
| `Space` or `Enter` | Click/Activate |
| `H` | Next heading |
| `B` | Next button |
| `D` | Next landmark |

### Test Sequence

#### 1. Page Load
```
Steps:
1. Start NVDA
2. Refresh page
3. Listen for hero announcement

Expected: "Hero section loaded. Use Tab to navigate through game options."
```

#### 2. Navigate with Arrow Keys
```
Steps:
1. Press Down Arrow several times
2. Listen for announcements

Expected sequence:
- Hero section (landmark)
- Welcome text
- Animated text
- Main title
- Buttons in order
```

#### 3. Navigate with "B" Key
```
Steps:
1. Press "B" to go to next button

Expected:
- Continue game button
- Multiplayer button
- Join room button
- Challenge AI button
```

#### 4. Activate Buttons
```
With button focused:
1. Press Space or Enter
2. Should navigate to new page
```

#### 5. Browse Mode
```
Steps:
1. Press "Q" to enter focus mode (if needed)
2. Tab through buttons
3. Focus ring should be visible

Expected:
- Tab works
- Focus ring visible on each button
- All buttons reachable
```

### Common Issues

**Issue:** NVDA not reading anything
- Solution: Press Ctrl+Shift+N to toggle reading
- Check if in browse mode (press Q to toggle)

**Issue:** Buttons not announced
- Solution: Ensure aria-label attributes exist
- Check focus mode vs browse mode

**Issue:** Can't activate buttons
- Solution: May need to press Enter instead of Space
- Check if button is properly focused

---

## JAWS (Windows)

### Enable JAWS

1. Press `Insert+F1` to start JAWS
2. Or use Start menu to launch JAWS

### Navigation

| Key | Action |
|-----|--------|
| `Down Arrow` | Next item |
| `Up Arrow` | Previous item |
| `Enter` | Click/Activate |
| `B` | Next button |
| `H` | Next heading |
| `H` then number | Go to heading level |

### Test Sequence

#### 1. Page Load
```
Steps:
1. Start JAWS
2. Navigate to page
3. Listen for announcement

Expected: Hero section load announcement
```

#### 2. Button Navigation
```
Steps:
1. Press "B" to go to next button
2. Repeat to cycle through all buttons

Expected: All 4 buttons announced
```

#### 3. Activation
```
Steps:
1. With button focused, press Enter
2. Should navigate to new page

Expected: Navigation works
```

#### 4. Virtual Cursor Mode
```
Steps:
1. Press Insert+Z to toggle virtual cursor
2. Use arrow keys to browse
3. Press Tab to tab through buttons

Expected: Both modes work correctly
```

---

## TalkBack (Android)

### Enable TalkBack

1. Settings → Accessibility → TalkBack → On
2. Agree to permissions

### Navigation

| Gesture | Action |
|---------|--------|
| Right Swipe | Next item |
| Left Swipe | Previous item |
| Double Tap | Activate/Click |
| Double Tap & Hold | Open context menu |

### Test Sequence

#### 1. App Load
```
Steps:
1. Open app with TalkBack on
2. Listen for announcement

Expected: "Hero section loaded" announcement
```

#### 2. Explore by Touch
```
Steps:
1. Move finger around hero section
2. Listen for announcements

Expected: Button names announced as you explore
```

#### 3. Activate Buttons
```
Steps:
1. Find button by exploring
2. Double tap to activate

Expected: Button activates, navigates
```

---

## iOS Voiceover (iPhone/iPad)

### Enable Voiceover

Settings → Accessibility → Voiceover → On

### Navigation

| Gesture | Action |
|---------|--------|
| Swipe Right | Next item |
| Swipe Left | Previous item |
| Double Tap | Activate/Click |
| Two-Finger Z Swipe | Undo |
| Rotor | Control+Option in Safari |

### Test Sequence

#### 1. Page Load
```
Steps:
1. Open landing page with Voiceover
2. Listen for announcement

Expected: "Hero section loaded" announcement
```

#### 2. Navigate
```
Steps:
1. Swipe right to navigate through items
2. Listen for button announcements

Expected: 
- "Continue game button"
- "Multiplayer button"
- "Join room button"
- "Challenge AI button"
```

#### 3. Activate
```
Steps:
1. Find button with swiping
2. Double tap to activate

Expected: Button activates, navigates
```

---

## Narrator (Windows)

### Enable Narrator

1. Windows Settings → Accessibility → Narrator
2. Toggle on
3. Or press `Windows+Ctrl+Enter`

### Keyboard

| Key | Action |
|-----|--------|
| `Caps+Right Arrow` | Next item |
| `Caps+Left Arrow` | Previous item |
| `Enter` | Click |
| `Caps+B` | List all buttons |

### Test Sequence

#### 1. Test Page Navigation
```
Steps:
1. Enable Narrator
2. Open landing page
3. Press Caps+Right Arrow to navigate

Expected: Items announced in order
```

#### 2. Test Button Navigation
```
Steps:
1. Press Caps+B for button list
2. Navigate with arrow keys

Expected: All 4 buttons in list
```

---

## Testing Checklist

For each screen reader, verify:

- [ ] Page load announcement heard
- [ ] "Hero section" identified
- [ ] All 4 buttons announced
- [ ] Button names are descriptive
- [ ] Buttons can be activated
- [ ] No spurious elements announced
- [ ] Navigation is logical
- [ ] Decorative elements hidden

---

## Expected Announcements by Screen Reader

### VoiceOver (macOS)
```
Page Load: "Web content"
Hero Section: "Hero, landmark"
Announcement: "Hero section loaded. Use Tab to navigate through game options."
Button 1: "Continue game, button"
Button 2: "Multiplayer, button"
Button 3: "Join room, button"
Button 4: "Challenge AI, button"
```

### NVDA (Windows)
```
Page Load: "Page loaded"
Hero Section: "Region, Hero"
Announcement: "Hero section loaded. Use Tab to navigate through game options."
Button 1: "Continue game button"
Button 2: "Multiplayer button"
Button 3: "Join room button"
Button 4: "Challenge AI button"
```

### JAWS (Windows)
```
Hero Section: "Region: Hero"
Announcement: "Hero section loaded. Use Tab to navigate through game options."
Button Navigation: "Press B for next button"
```

### TalkBack (Android)
```
Button: "Continue game, button, double-tap to activate"
```

### Voiceover (iOS)
```
Button: "Continue game, button"
Hint: "Double-tap to activate"
```

---

## Troubleshooting

### General Issues

**Screen reader not reading:**
- Check if screen reader is enabled
- Try refreshing page
- Check if browser tab is focused
- Check if volume is on

**Can't hear anything:**
- Verify audio output device is selected
- Check system volume
- Try different speaker/headphones
- Restart screen reader

**Announcement not heard:**
- Refresh page after enabling screen reader
- Check browser console for errors
- Verify aria-live and role attributes exist

### Per Screen Reader

**VoiceOver:**
- Use Cmd+Option+Right Arrow for detailed navigation
- Use Rotor (Cmd+Option+U) to jump to sections
- Check Safari web rotor for better element access

**NVDA:**
- Use "Browse Mode" for better page navigation
- Use "Focus Mode" for interactive elements
- Use "Elements List" (Ctrl+Shift+F7) to see all buttons

**JAWS:**
- Use Virtual Cursor for page overview
- Use Focus Mode for interactive elements
- Use "Say All" (Insert+Down Arrow) to read entire page

**TalkBack:**
- Use "Reading Controls" for options
- Try different reading speeds
- Check if Local Context active

**Voiceover:**
- Use Rotor to navigate sections
- Try different gesture combinations
- Check Settings for verbosity level

---

## Test Results Template

Use this template to document results:

```
Screen Reader: [Name]
Date: [Date]
Tester: [Name]

Page Load Announcement:  ☐ Pass / ☐ Fail
Button 1 Announced:      ☐ Pass / ☐ Fail
Button 2 Announced:      ☐ Pass / ☐ Fail
Button 3 Announced:      ☐ Pass / ☐ Fail
Button 4 Announced:      ☐ Pass / ☐ Fail
Buttons Activatable:     ☐ Pass / ☐ Fail
Decorative Hidden:       ☐ Pass / ☐ Fail
Navigation Logical:      ☐ Pass / ☐ Fail

Notes:
[Any issues or observations]

Result: ☐ PASS / ☐ FAIL
```

---

## Resources

- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [NVDA User Guide](https://www.nvaccess.org/download/)
- [JAWS Documentation](https://www.freedomscientific.com/products/software/jaws/)
- [Voiceover Guide](https://www.apple.com/voiceover/resources/)
- [TalkBack Help](https://support.google.com/accessibility/android/answer/6283677)

---

**Testing Complete** ✅

When all screen readers announce correctly and navigation works, the implementation is ready for production.
