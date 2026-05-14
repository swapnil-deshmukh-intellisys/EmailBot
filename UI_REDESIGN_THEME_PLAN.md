# UI Redesign Theme Plan

## Current UI Problems Found
- Dark mode is improved, but several dashboard sections still depend on older page-specific white/gray glass rules.
- Theme tokens exist, but newer names requested for the design system are not fully mapped across the app.
- Dashboard layout is dense on desktop and relies on fixed visual treatments from `globals.css`.
- Sidebar, workflow, table controls, activity widgets, and form controls need stronger shared theme rules.
- Mobile/tablet safeguards exist, but dashboard-specific panels need better stacking, scroll containment, and touch sizing.

## Files / Components To Update
- `dashboard-next/app/theme.css`
  - Main global token layer and responsive UI architecture.
  - Theme-specific Light, Dark, and Aurora Colour visual rules.
- `dashboard-next/shared-components/layout-components/ThemeProvider.jsx`
  - Keep existing persistence and no-reload theme switching intact.
- `dashboard-next/shared-components/layout-components/SharedThemeToggleControl.jsx`
  - Keep current global toggle behavior and labels.
- `dashboard-next/app/dashboard/components/PremiumDashboardShell.jsx`
  - Avoid behavior changes. Only adjust if a small theme class hook is needed.
- Existing shared layout components:
  - `SharedSidebarNavigation.jsx`
  - `SharedTopbarNavigation.jsx`
  - Existing mobile dock / shell classes

## Theme Architecture Plan
- Preserve current storage key `theme` and theme values for backward compatibility.
- Expand CSS variables to include:
  - `--bg-app`, `--bg-surface`, `--bg-elevated`, `--bg-glass`, `--bg-sidebar`, `--bg-topbar`, `--bg-card`, `--bg-table`
  - `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`
  - `--border-soft`, `--border-strong`, `--border-glass`
  - `--accent-primary`, `--accent-secondary`, `--accent-tertiary`, `--accent-gradient`, `--accent-glow`
  - status, shadow, blur, and radius tokens
- Keep `colorful` as the internal value while presenting it as `Colour / Aurora Colour`.
- Add higher-specificity global selectors for dashboard UI so hardcoded legacy styles do not override theme tokens.

## Responsive Layout Plan
- Keep page width contained and prevent horizontal overflow globally.
- Collapse sidebar at tablet widths using existing shell behavior.
- Make dashboard content grids stack cleanly at 1199px, 1024px, 767px, and 480px.
- Turn workflow into horizontal scroll on tablet/mobile.
- Keep tables inside scroll containers on tablet, and add mobile card-like row behavior where possible without changing data markup.
- Ensure modals fit viewport height and scroll internally.

## Reusable Component Plan
- Prefer existing components and class hooks instead of rewriting business logic.
- Standardize reusable visual classes in CSS:
  - shell, topbar, sidebar, bottom dock
  - stat cards, section cards, glass panels
  - campaign workflow, step cards
  - data table, mobile rows
  - timeline, activity feed, notes, calendar, inbox
  - buttons, badges, inputs, filters

## Risk Areas
- Campaign workflow upload/review/draft/schedule behavior must not change.
- Draft editor, rich text, and saved draft API flow must remain untouched.
- Client data upload/list/duplicate logic must remain untouched.
- Admin/user dashboard authentication and redirects must remain untouched.
- API routes must not be edited for this UI pass.

## Testing Checklist
- Build completes.
- `/login` responds locally.
- Theme toggle still switches without reload.
- Theme persists after refresh using `localStorage.theme`.
- Dashboard remains usable in Light, Dark, and Colour themes.
- Mobile/tablet layouts have no page-level horizontal overflow.
- Campaign workflow, tables, forms, and modals remain visible and readable.
