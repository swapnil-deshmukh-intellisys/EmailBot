# UI Theme Responsive Plan

## Scope
- Preserve existing functionality, APIs, campaign workflow behavior, and saved data.
- Build on the existing ThemeProvider, localStorage persistence, and 3-option ThemeToggle already present in the app.
- Move core theme tokens into a dedicated global theme stylesheet and keep Colour mode compatible with the current premium colorful UI.

## Implementation Steps
1. Audit existing theme/provider/topbar/global CSS and reuse the established `light`, `dark`, and `colorful` theme keys.
2. Add/centralize design tokens for surfaces, text, borders, buttons, inputs, tables, modals, navigation, docks, shadows, and radii.
3. Import the token stylesheet before global component styles.
4. Add broad reusable theme-aware selectors for app shells, cards, panels, forms, buttons, tables, modals, popovers, and notifications.
5. Add responsive safeguards for mobile/tablet: no horizontal overflow, stacked cards/forms, scrollable nav/tabs, internal modal scrolling, table overflow/card fallback support.
6. Add reduced-motion and low-end-device friendly transition rules.
7. Verify build and create a changelog with files changed and a testing checklist.

## Acceptance Focus
- One-click theme switch works globally and persists after refresh.
- Light, Dark, and Colour themes have readable contrast.
- Existing colorful design remains the default premium visual direction.
- Mobile/tablet/laptop/desktop layouts avoid page-level horizontal overflow.
- No API or workflow behavior changes.
