# UI Final Testing Checklist

## Responsive Testing
- [x] Global CSS prevents page-level horizontal overflow.
- [x] Dashboard grids use responsive `auto-fit` / `minmax()` behavior.
- [x] Workflow stepper scrolls horizontally on tablet/mobile.
- [x] Topbar and toolbar controls scroll or wrap safely on narrow screens.
- [ ] Manual viewport QA: 320px.
- [ ] Manual viewport QA: 375px.
- [ ] Manual viewport QA: 430px.
- [ ] Manual viewport QA: 768px.
- [ ] Manual viewport QA: 1024px.
- [ ] Manual viewport QA: 1280px.
- [ ] Manual viewport QA: 1440px.
- [ ] Manual viewport QA: 1920px.

## Theme Testing
- [x] Light, Dark, and Aurora Colour tokens are defined globally.
- [x] Theme aliases resolve safely: `colour`, `aurora`, `aurora-colour`.
- [x] Dark theme surfaces are re-normalized for cards, topbar, sidebar, tables, and panels.
- [x] Theme remains stored in `localStorage.theme`.
- [ ] Manual QA: Light theme across authenticated pages.
- [ ] Manual QA: Dark theme across authenticated pages.
- [ ] Manual QA: Aurora Colour theme across authenticated pages.

## Accessibility Testing
- [x] Touch targets use 42px-44px minimum where possible.
- [x] Focusable button/input sizing is standardized globally.
- [x] Text line-height and wrapping are normalized.
- [ ] Manual keyboard navigation QA.
- [ ] Manual contrast QA on all themes.

## Button Testing
- [x] Buttons and pills use consistent min-height.
- [x] Button text can wrap instead of clipping.
- [x] Action groups wrap or scroll on smaller widths.
- [ ] Manual QA: campaign action menus.
- [ ] Manual QA: modal action buttons.

## Form Testing
- [x] Inputs/selects/textareas use theme-aware backgrounds and colors.
- [x] Form fields fit parent width.
- [x] Textareas can resize vertically where useful.
- [ ] Manual QA: upload form.
- [ ] Manual QA: campaign form.
- [ ] Manual QA: draft editor form.

## Overflow Testing
- [x] Global `min-width: 0` applied to layout primitives.
- [x] Common card/widget text wraps safely.
- [x] Tables are contained in scroll wrappers.
- [x] Modals use viewport-safe width/height.
- [ ] Manual QA: no clipped text on dashboard.
- [ ] Manual QA: no hidden buttons on mobile.

## Modal Testing
- [x] Modals cap at viewport width and height.
- [x] Modal internals can scroll.
- [ ] Manual QA: Upload List modal.
- [ ] Manual QA: Review List modal.
- [ ] Manual QA: Select Draft modal.
- [ ] Manual QA: Schedule Sending modal.

## Table Testing
- [x] Sticky headers remain theme-aware.
- [x] Cells wrap instead of forcing page overflow.
- [x] Mobile table rows become card-like for premium/campaign tables.
- [ ] Manual QA: Broadcast table.
- [ ] Manual QA: Client Data table.
- [ ] Manual QA: Reports/Admin tables.

## Mobile / Tablet / Desktop Testing
- [x] Mobile toolbar controls are scroll-safe.
- [x] Tablet content grids stack to one or two columns.
- [x] Desktop content width is constrained.
- [ ] Manual mobile QA with real account data.
- [ ] Manual tablet QA with real account data.
- [ ] Manual desktop QA with real account data.

## Performance Testing
- [x] No new business-logic rerenders introduced.
- [x] CSS-only polish used for global fixes.
- [x] Reduced-motion disables skeleton animation.
- [ ] Manual performance QA on low-end laptop/mobile.

## Build / Smoke Testing
- [x] Production build completes.
- [x] `/login` responds locally after build.
- [ ] Dashboard route loads after login.
