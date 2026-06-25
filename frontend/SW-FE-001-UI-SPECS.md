# SW-FE-001: Error & Empty State UI Specifications

**Component**: Landing Hero (`HeroSection.tsx`)  
**Scope**: Visual design + interaction patterns  
**Batch**: Stellar Wave — Frontend

---

## 1. Error State UI

### Layout
```
┌─────────────────────────────────────────┐
│                                         │
│        [Alert Icon with Glow]           │
│                                         │
│     Something went wrong                │
│                                         │
│   An unexpected error occurred.         │
│   Please try again in a few moments.    │
│                                         │
│   [Show error code] ← (optional)        │
│                                         │
│   [Try Again Button - Primary]          │
│                                         │
│   [Go Home Button - Secondary]          │
│                                         │
│   Need help?                            │
│   Contact support ← (link)              │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Hierarchy
1. **Alert Icon** (top, 80px diameter)
   - Red circle (#EF4444)
   - Red alert icon (lucide-react `AlertCircle`)
   - Halo glow effect (red-500/20 blur)
   - Centered horizontally

2. **Title** (24px/28px)
   - Font: Orbitron Bold (font-orbitron)
   - Color: Cyan (#00F0FF)
   - Text: "Something went wrong"

3. **Message** (14px/16px)
   - Font: DM Sans Regular
   - Color: Light text (#F0F7F7)
   - Multi-line, centered
   - Line height: 1.5

4. **Error Code Toggle** (optional, 12px)
   - Font: DM Sans
   - Color: Cyan (#00F0FF)
   - Icon: Eye (show) or EyeOff (hide)
   - Only if error type present

5. **Error Code Display** (conditional)
   - Font: Monospace, 12px
   - Background: Black with 20% opacity
   - Padding: 8px
   - Border radius: 6px
   - Examples:
     - `rate_limit`
     - `validation`
     - `navigation`

6. **Primary Button** (56px height, 100% width)
   - Text: "Try Again"
   - Background: Cyan (#00F0FF)
   - Text color: Dark background (#010F10)
   - Font: Orbitron Bold 14px
   - Hover: opacity 90%
   - Active: scale 95%

7. **Secondary Button** (56px height, 100% width)
   - Text: "Go Home"
   - Background: Transparent
   - Border: 2px solid dark border (#003B3E)
   - Text color: Light (#F0F7F7)
   - Font: Orbitron Bold 14px
   - Hover: opacity 90%
   - Active: scale 95%

8. **Support Link** (12px)
   - Font: DM Sans
   - Color: Cyan (#00F0FF)
   - Style: Underlined
   - Hover: opacity 70%
   - Link: `/support`

### Colors
| Element | Color | Value |
|---------|-------|-------|
| Background | Dark primary | #010F10 |
| Alert icon | Red | #EF4444 |
| Halo effect | Red overlay | #EF4444 (20% opacity) |
| Title | Cyan | #00F0FF |
| Message | Light text | #F0F7F7 |
| Button 1 bg | Cyan | #00F0FF |
| Button 1 text | Dark | #010F10 |
| Button 2 border | Dark border | #003B3E |
| Button 2 text | Light | #F0F7F7 |
| Link | Cyan | #00F0FF |

### Spacing (all in rem)
- Icon to title: 24px (1.5rem)
- Title to message: 12px (0.75rem)
- Message to toggle: 12px (0.75rem)
- Toggle to buttons: 16px (1rem)
- Button gap: 12px (0.75rem)
- Button to link: 24px (1.5rem)
- Left/right padding: 16px (1rem)

### Responsive Breakpoints
| Breakpoint | Title Size | Message Size | Button Width |
|------------|-----------|-------------|----|
| Mobile (< md) | 20px | 14px | Full width |
| Tablet (md) | 24px | 16px | Full width |
| Desktop (lg) | 28px | 16px | Full width |

---

## 2. Empty State UI — Loading

### Layout
```
┌─────────────────────────────────────────┐
│                                         │
│    ● ● ●  (animated pulse dots)         │
│                                         │
│            Loading...                   │
│                                         │
│    Getting things ready for you.        │
│                                         │
│    This usually takes a moment.         │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Elements
1. **Loading Indicator** (top)
   - Three dots, 12px diameter each
   - Gap between dots: 8px
   - Color: Cyan (#00F0FF)
   - Animation: Sequential pulse
     - Dot 1: delay 0ms, duration 1400ms
     - Dot 2: delay 150ms, duration 1400ms
     - Dot 3: delay 300ms, duration 1400ms
   - Respects `prefers-reduced-motion` (animation disabled)

2. **Title** (24px/28px)
   - Font: Orbitron Bold
   - Color: Cyan (#00F0FF)
   - Text: "Loading..."

3. **Description** (14px/16px)
   - Font: DM Sans Regular
   - Color: Light text (#F0F7F7)
   - Text: "Getting things ready for you."

4. **Hint** (12px)
   - Font: DM Sans Regular
   - Color: Light text with 70% opacity
   - Text: "This usually takes a moment."

### Accessibility
- ARIA: `role="status"` + `aria-busy="true"`
- No interactive buttons (prevents user action during load)
- Message updates via live region

---

## 3. Empty State UI — Offline

### Layout
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│            Offline                      │
│                                         │
│    Check your connection and try again. │
│                                         │
│    Make sure you're connected to the    │
│    internet.                            │
│                                         │
│   [Reload Button]                       │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Elements
1. **Title** (24px/28px)
   - Font: Orbitron Bold
   - Color: Cyan (#00F0FF)
   - Text: "Offline"

2. **Description** (14px/16px)
   - Font: DM Sans Regular
   - Color: Light text (#F0F7F7)
   - Text: "Check your connection and try again."

3. **Hint** (12px)
   - Font: DM Sans Regular
   - Color: Light text (70% opacity)
   - Text: "Make sure you're connected to the internet."

4. **Reload Button** (56px height, full width)
   - Text: "Reload"
   - Background: Cyan (#00F0FF)
   - Text color: Dark (#010F10)
   - Font: Orbitron Bold 14px
   - Action: `window.location.reload()`

### Accessibility
- ARIA: `role="status"` + `aria-busy="false"`

---

## 4. Empty State UI — Maintenance

### Layout
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│      Under Maintenance                  │
│                                         │
│    We're making improvements to the     │
│    game.                                │
│                                         │
│    Check back soon!                     │
│                                         │
│   [Reload Button]                       │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Elements
1. **Title** (24px/28px)
   - Font: Orbitron Bold
   - Color: Cyan (#00F0FF)
   - Text: "Under Maintenance"

2. **Description** (14px/16px)
   - Font: DM Sans Regular
   - Color: Light text (#F0F7F7)
   - Text: "We're making improvements to the game."

3. **Hint** (12px)
   - Font: DM Sans Regular
   - Color: Light text (70% opacity)
   - Text: "Check back soon!"

4. **Reload Button** (same as offline)

---

## 5. Interaction Patterns

### Error State Flow
```
USER CLICKS CTA
    ↓
[Validation]
    ├─ Valid → Navigate (success)
    └─ Invalid → Show Error State
         ↓
    [User sees error message + icon + actions]
         ↓
    [User clicks "Try Again"] → Clears error, resets
    [User clicks "Go Home"] → Navigate to /
    [User clicks "Contact support"] → Navigate to /support
```

### Loading State Flow
```
SERVICE LOADING
    ↓
[Show loading state]
    ├─ Animated pulse dots
    ├─ "Loading..." message
    └─ No interactive buttons
         ↓
    [Service ready] → Transition to main content
```

### State Transitions
- **Error → Normal**: Smooth fade via conditional render
- **Loading → Content**: Controlled by parent component
- **Duration**: Instant (no animations for state transitions)

---

## 6. Keyboard Interaction

### Focus States
```
[Try Again Button] ← Focus ring (outline)
  └─ Background: Cyan with reduced opacity
  └─ Visible focus indicator (ring-2)

[Go Home Button] ← Focus ring (outline)
  └─ Border enhanced
  └─ Clear focus indicator

[Contact support] ← Focus ring (outline)
  └─ Underline + outline
```

### Tab Order
1. Try Again button (primary action)
2. Go Home button (secondary action)
3. Contact support link (help)

### Screen Reader Announcements
- **Error state**: "Alert: Something went wrong. {message}"
- **Show code button**: "Button: Show error code"
- **Try Again**: "Button: Try again"
- **Go Home**: "Button: Go to home"
- **Support link**: "Link: Contact support"

---

## 7. Mobile Responsiveness

### Screen Sizes
| Size | Breakpoint | Adjustments |
|------|-----------|-------------|
| XS (< 320px) | Mobile | Reduced padding (8px), font sizes -1px |
| SM (320-640px) | Mobile | Standard spacing |
| MD (640-1024px) | Tablet | Increased spacing |
| LG (1024+px) | Desktop | Full width, max-width 500px centered |

### Mobile Considerations
- **Buttons**: Full width for touch targets (48px min height)
- **Text**: Readable without zoom (16px min)
- **Spacing**: Adequate for thumb interaction
- **Icon**: Larger on mobile (72px vs 80px on desktop)

---

## 8. Animation Details

### Loading Pulse
```css
/* Single dot */
animation: pulse 1.4s ease-in-out infinite;

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
```

### Button Interactions
```css
/* Hover */
transition: opacity 0.2s ease;
opacity: 90%;

/* Active (clicked) */
transform: scale(0.95);
transition: transform 0.1s ease;
```

### Error Icon Glow (static)
```css
/* Outer ring */
position: absolute;
border-radius: 50%;
background: rgba(239, 68, 68, 0.2);
filter: blur(20px);
```

---

## 9. Color Palette

### Dark Theme (Active)
```
Primary background: #010F10
Secondary background: #0a2a2d
Card background: #0E1415
Border color: #003B3E
Text primary: #F0F7F7
Text secondary: #869298
Accent: #00F0FF
Accent alt: #0FF0FC
Error: #EF4444
```

### Light Theme (Future)
```
(Currently only dark theme implemented)
```

---

## 10. Accessibility Features

### ARIA Attributes
```html
<!-- Error state -->
<section role="alert" aria-live="assertive" aria-label="Hero Error">

<!-- Empty state (loading) -->
<section role="status" aria-busy="true" aria-label="Hero Unavailable">

<!-- Empty state (offline/maintenance) -->
<section role="status" aria-busy="false" aria-label="Hero Unavailable">

<!-- Buttons -->
<button aria-label="Try again">
<button aria-label="Go to home">
<button aria-label="Reload page">
```

### Screen Reader Testing Checklist
- [ ] Alert announcement triggered on error
- [ ] Error message read clearly
- [ ] Button labels announced
- [ ] Status updates announced (loading complete)
- [ ] Support link identified as link
- [ ] No redundant announcements

### Keyboard Testing Checklist
- [ ] All buttons focusable via Tab
- [ ] Focus ring visible
- [ ] Enter/Space activates buttons
- [ ] No keyboard trap
- [ ] Tab order logical

---

## 11. Dark Mode Considerations

✅ Already implemented (dark theme is primary)

The design uses CSS variables that adapt to `[data-theme="dark"]` attribute:
```css
--background: #010f10;
--foreground: #f0f7f7;
--tycoon-accent: #00f0ff;
--tycoon-border: #003b3e;
```

Future light mode: Use `--background: #ffffff` with adjusted colors.

---

## Approval & Sign-Off

- [x] Design follows existing brand guidelines
- [x] Color contrast meets WCAG AA
- [x] Responsive at all breakpoints
- [x] Accessibility features included
- [x] Keyboard navigation implemented
- [x] Mobile-friendly
- [x] Animation respects motion preferences

**Ready for Implementation**: ✅ YES
