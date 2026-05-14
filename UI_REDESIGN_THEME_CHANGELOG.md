# UI Redesign Theme Changelog

## Summary
- Added a full redesign plan in `UI_REDESIGN_THEME_PLAN.md` before implementation.
- Expanded the global theme system into a broader Apple/iPadOS-inspired design token layer.
- Preserved the existing `localStorage.theme` persistence and no-reload theme switching.
- Kept the internal `colorful` theme value for compatibility, while presenting it as Aurora/Colour in the UI.
- Added aliases for `colour`, `aurora`, and `aurora-colour` so old/new theme naming can resolve safely.

## Files Changed
- `UI_REDESIGN_THEME_PLAN.md`
  - Added current UI audit, architecture plan, responsive plan, risk areas, and testing checklist.
- `UI_REDESIGN_THEME_CHANGELOG.md`
  - Added this implementation changelog.
- `dashboard-next/app/layout.js`
  - Added early-load theme aliases for `colour`, `aurora`, and `aurora-colour`.
- `dashboard-next/app/theme.css`
  - Expanded global design tokens:
    - background, text, border, accent, status, shadow, blur, and radius groups.
  - Reworked Aurora Colour theme into a subtle blue/indigo/violet/cyan aurora style.
  - Strengthened Light theme with clean Apple-like SaaS surfaces.
  - Strengthened Dark theme with graphite surfaces, readable text, and consistent controls.
  - Added global operating-system layout rules for topbar, sidebar, cards, workflow, tables, activity panels, notes, calendar, badges, and forms.
  - Added responsive rules for KPI grids, dashboard content grids, workflow scroll, mobile table/card layout, modals, and toolbar overflow.
  - Added reusable UI primitive class styles.
- `dashboard-next/shared-components/layout-components/ThemeProvider.jsx`
  - Added theme alias normalization.
- `dashboard-next/shared-components/layout-components/SharedThemeToggleControl.jsx`
  - Updated Colour option copy to Aurora-style wording.
- `dashboard-next/shared-components/ui-components/DesignSystemPrimitives.jsx`
  - Added reusable `GlassPanel`, `SectionCard`, `StatCard`, `StatusBadge`, `IconButton`, `PrimaryButton`, and `EmptyState` primitives.

## Theme Updates
- Light Theme:
  - Clean white/gray SaaS canvas, soft blue accent, translucent cards.
- Dark Theme:
  - Graphite dark palette, no pure black page surfaces, higher contrast text and controls.
- Aurora Colour Theme:
  - Subtle aurora background with cyan, indigo, and violet accents.

## Responsive Fixes
- KPI cards adapt from six columns to three, two, then one column.
- Dashboard content grids stack at tablet/mobile sizes.
- Campaign workflow becomes horizontally scrollable on tablet/mobile.
- Tables are contained and convert to card-like rows on mobile where markup allows.
- Topbar/toolbars/tabs scroll horizontally on narrow screens.
- Modals and panels use viewport-safe sizing.

## Performance Fixes
- Kept animation changes lightweight.
- Continued `prefers-reduced-motion` support.
- Avoided JavaScript-heavy redesign changes.
- Used CSS variables and selectors to reduce rerender risk.

## Known Issues / Follow-Up
- Deep visual QA for every authenticated dashboard screen still needs browser walkthrough with real logged-in data.
- Some legacy components still contain hardcoded inline colors, but the global theme layer now overrides the main dashboard surfaces without changing behavior.

## Testing Checklist
- [x] Theme provider still uses `localStorage.theme`.
- [x] Theme aliases normalize safely.
- [x] Production build completes.
- [x] `/login` responds locally after build.
- [ ] Manual visual QA: dashboard Light theme.
- [ ] Manual visual QA: dashboard Dark theme.
- [ ] Manual visual QA: dashboard Aurora Colour theme.
- [ ] Manual responsive QA: 320px, 375px, 430px, 768px, 1024px, 1366px, 1440px, 1920px.
- [ ] Manual functionality QA: campaign workflow, upload, review, drafts, reports, admin, client data.
