# Quickstart: 002-theme-toggle

**Date**: 2026-02-18

---

## Prerequisites

- Node.js 20+
- Project running locally (`npm run dev`)
- Branch `002-theme-toggle` checked out

## How to Verify

### 1. Visual Theme Switching

1. Open `http://localhost:3000/judges/` in a browser
2. Locate the icon button flush-right in the header
3. Click once → page switches to dark mode (moon icon)
4. Click again → page follows system preference (monitor icon)
5. Click again → page switches to light mode (sun icon)
6. Verify all text, backgrounds, borders, and links change color appropriately

### 2. Persistence

1. Set theme to "dark" (moon icon)
2. Refresh the page (Cmd+R / F5)
3. Page should load in dark mode with no flash of light theme
4. Open DevTools → Application → Local Storage → `localhost`
5. Verify key `theme` exists with value `dark`

### 3. FOUC Prevention

1. Set theme to "dark"
2. Hard refresh (Cmd+Shift+R)
3. Watch carefully — the page should render dark from the very first paint
4. (Optional) Throttle CPU in DevTools to 4x slowdown to make any flash visible

### 4. System Theme Follow

1. Click toggle until you see the monitor icon (system mode)
2. Open macOS System Settings → Appearance
3. Switch between Light and Dark
4. The page should update in real-time without clicking the toggle

### 5. Accessibility

1. Tab to the toggle button — it should receive visible focus
2. Press Enter or Space — theme should cycle
3. Use a screen reader — button should announce its current label (e.g., "Dark mode — click for system")
4. Run Lighthouse accessibility audit — should maintain 100 score

### 6. Cross-Page Consistency

1. Set theme to "dark"
2. Navigate to different public pages: `/judges/`, `/judges/california/`, `/judges/california/los-angeles/`
3. Navigate to admin pages: `/admin/`, `/admin/judges/`, `/admin/judges/new/`
4. All pages (public and admin) should render in dark mode
5. No flash on navigation
6. Resize viewport from 320px to 2560px — toggle icon remains visible and header layout is intact (SC-004)

### 7. Build Verification

```bash
npm run build
```

All routes should compile without errors. No new warnings.

## Key Files

| File                             | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `src/app/theme-vars.css`         | CSS custom properties (light/dark tokens)                            |
| `src/app/layout.tsx`             | Root layout — imports CSS, inline FOUC script, ThemeToggle in header |
| `src/components/ThemeToggle.tsx` | Client component — toggle button with icons                          |
| `src/lib/theme.ts`               | Types, constants, helper functions                                   |
