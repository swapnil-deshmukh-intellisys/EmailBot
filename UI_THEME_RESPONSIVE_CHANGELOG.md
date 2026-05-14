# UI Theme Responsive Changelog

## Summary
- Added a dedicated global theme token layer for Light, Dark, and Colour themes.
- Preserved the existing ThemeProvider, localStorage persistence, and no-reload switching behavior.
- Strengthened global iOS-style glass surfaces across shells, topbars, sidebars, cards, panels, buttons, forms, tables, modals, popovers, docks, and upload/review areas.
- Added responsive safety rules for mobile, large mobile, tablet, iPad landscape, laptop, and desktop breakpoints.
- Refined the dark dashboard view so sidebar, workflow, tables, activity panels, cards, filters, and buttons share one consistent premium dark palette.

## Files Changed
- `UI_THEME_RESPONSIVE_PLAN.md`
  - Added implementation plan before code changes.
- `UI_THEME_RESPONSIVE_CHANGELOG.md`
  - Added this changelog and testing checklist.
- `dashboard-next/app/layout.js`
  - Imported the new global theme stylesheet.
- `dashboard-next/app/theme.css`
  - Added global design tokens:
    - `--bg-main`
    - `--bg-surface`
    - `--bg-card`
    - `--bg-glass`
    - `--text-main`
    - `--text-muted`
    - `--border-soft`
    - `--accent-primary`
    - `--accent-secondary`
    - `--button-bg`
    - `--button-text`
    - `--danger`
    - `--success`
    - `--warning`
    - `--shadow-card`
    - `--radius-card`
    - `--sidebar-bg`
    - `--topbar-bg`
    - `--dock-bg`
  - Added broad theme-aware selectors for common app UI.
  - Added responsive rules for:
    - Mobile `320px-480px`
    - Large mobile `481px-767px`
    - Tablet `768px-1024px`
    - iPad landscape `1025px-1199px`
    - Laptop `1200px-1440px`
    - Desktop `1441px+`
  - Added reduced-motion support.
- `dashboard-next/shared-components/layout-components/SharedThemeToggleControl.jsx`
  - Renamed the Colorful option label to `Colour`.
  - Updated option helper text.

## Bugs / UX Issues Addressed
- Theme surfaces now share the same token system across more of the app.
- Dark mode has stronger global contrast for cards, tables, forms, and modals.
- Dark mode dashboard sections no longer inherit bright white/gray glass surfaces from the Colour theme.
- Campaign workflow cards, chips, Start button, broadcast table controls, and activity panels now use matching dark surfaces.
- Sidebar navigation and subscription/logout cards now match the dark theme instead of appearing washed out.
- Light mode uses cleaner white/gray surfaces with soft blue accents.
- Colour mode keeps the current premium branded style while using the same token names.
- Modals now have stricter viewport sizing and internal scrolling.
- Common table wrappers and tab bars avoid page-level horizontal overflow.
- Buttons and controls have mobile-friendly touch target minimums.
- Reduced-motion users avoid heavy transitions/animations.

## Testing Checklist
- [x] Production build completes.
- [x] ThemeProvider still uses `localStorage` key `theme`.
- [x] Theme toggle still switches without page reload.
- [x] Light/Dark/Colour theme class and `data-theme` remain compatible.
- [x] `/login` loads after build.
- [ ] Manual visual QA: dashboard Light theme.
- [ ] Manual visual QA: dashboard Dark theme.
- [ ] Manual visual QA: dashboard Colour theme.
- [ ] Manual visual QA: Client Data mobile/tablet.
- [ ] Manual visual QA: Campaign Workflow mobile/tablet.
- [ ] Manual visual QA: Drafts page mobile/tablet.
- [ ] Manual visual QA: Reports/Admin/Inbox pages.
