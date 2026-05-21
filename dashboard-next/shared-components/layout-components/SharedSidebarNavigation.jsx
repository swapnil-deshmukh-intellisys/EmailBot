'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui-components/UiActionButton';
import Input from '../ui-components/UiTextInputField';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS } from '@/app/dashboard/DashboardNavigationLayoutConfig';
import { cn } from '@/app/lib/UiClassNameUtility';

const defaultNavItems = SIDEBAR_WORKSPACE_ITEMS.map((item) => ({ href: item.href, label: item.label }));

function isActive(pathname, href) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  primaryItems = SIDEBAR_PRIMARY_ITEMS,
  navItems = defaultNavItems,
  brand = 'Intelli Mail Pilot',
  brandHref = '/dashboard/user',
  footer = null,
  mobileOpen = false,
  onMobileClose = null,
  showSearch = true,
  searchPlaceholder = 'Search',
  className = ''
}) {
  const [searchValue, setSearchValue] = useState('');
  const [billingSummary, setBillingSummary] = useState({
    planName: 'Basic',
    upgradeTargetPlan: 'Pro',
    remainingCredits: 1200,
    totalCredits: 6000,
    creditUsagePercent: 0
  });
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/credits', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.ok || !data?.summary) return;
        setBillingSummary({
          planName: String(data.summary.planName || 'Basic').trim() || 'Basic',
          upgradeTargetPlan: String(data.summary.upgradeTargetPlan || '').trim() || 'Pro',
          remainingCredits: Number(data.summary.remainingCredits || 0),
          totalCredits: Number(data.summary.totalCredits || 0),
          creditUsagePercent: Number(data.summary.creditUsagePercent || 0)
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const billingHasUpgrade = useMemo(
    () => billingSummary.upgradeTargetPlan && billingSummary.upgradeTargetPlan !== billingSummary.planName,
    [billingSummary.planName, billingSummary.upgradeTargetPlan]
  );

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  const handleOpenBilling = () => {
    router.push('/dashboard/user#billing');
    router.refresh();
  };

  return (
    <aside className={cn('dashboard-sidebar', mobileOpen ? 'mobile-open' : '', className)}>
      <div className="dashboard-sidebar-card">
        <button
          type="button"
          className="dashboard-sidebar-close"
          onClick={onMobileClose}
          aria-label="Close navigation menu"
        >
          x Close
        </button>
        <div className="dashboard-brand">
          <Link href={brandHref} className="dashboard-brand-link">
            <img
              src="/intellimailpilot-logo.png"
              alt={brand}
              className="dashboard-brand-logo"
            />
          </Link>
        </div>

        <div className="dashboard-sidebar-stack">
          {showSearch ? (
            <div className={`dashboard-topbar-search dashboard-sidebar-search ${searchValue ? 'active' : ''}`}>
              <span className="dashboard-topbar-search-icon">⌕</span>
              <Input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                aria-label="Search"
                placeholder={searchPlaceholder}
              />
            </div>
          ) : null}
          {primaryItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`dashboard-primary-link ${item.tone} ${isActive(pathname, item.href) ? 'active' : ''}`}
            >
              <span className="dashboard-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="dashboard-sidebar-nav" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
          <nav className="dashboard-sidebar-menu">
            {navItems.map((item) => {
              const matchingWorkspaceItem = SIDEBAR_WORKSPACE_ITEMS.find(
                (workspaceItem) => workspaceItem.href === item.href || workspaceItem.label === item.label
              );
              return (
                <div key={item.href || item.label} className="dashboard-sidebar-item">
                  <Link
                    href={item.href}
                    className={`dashboard-sidebar-link ${isActive(pathname, item.href) ? 'active' : ''}`}
                  >
                    {matchingWorkspaceItem?.icon ? <span className="dashboard-link-icon soft">{matchingWorkspaceItem.icon}</span> : null}
                    <span>{item.label}</span>
                    {item.badge ? <em className="dashboard-sidebar-badge">{item.badge}</em> : null}
                  </Link>
                </div>
              );
            })}
          </nav>
          {footer ? (
            <div className="dashboard-sidebar-footer">{footer}</div>
          ) : (
            <div className="dashboard-sidebar-footer">
              <div className="dashboard-upgrade-card">
                <div className="dashboard-upgrade-head">
                  <span className="dashboard-upgrade-icon" aria-hidden="true">↯</span>
                  <strong>Upgrade plan</strong>
                  <span className="dashboard-upgrade-refresh" aria-hidden="true">↻</span>
                </div>
                <div className="dashboard-upgrade-credit-strip">
                  <span>
                    <small>{billingSummary.planName} plan</small>
                    <strong>{Number(billingSummary.remainingCredits || 0).toLocaleString()} credits left</strong>
                  </span>
                  <em>{Number(billingSummary.remainingCredits || 0) <= 0 ? 'Empty' : 'Active'}</em>
                </div>
                <div className="dashboard-upgrade-meta">
                  <span>
                    <small>Current plan</small>
                    <strong>{billingSummary.planName}</strong>
                    <b>Free forever</b>
                  </span>
                  <span>
                    <small>Next plan</small>
                    <strong>{billingSummary.upgradeTargetPlan}</strong>
                    <b>{Number(billingSummary.totalCredits || 500).toLocaleString()} credits</b>
                  </span>
                </div>
                <Button className="dashboard-upgrade-button" onClick={handleOpenBilling}>
                  {billingHasUpgrade ? `Upgrade to ${billingSummary.upgradeTargetPlan}` : 'Manage Plan'} <span aria-hidden="true">→</span>
                </Button>
              </div>

              <Button variant="danger" className="dashboard-logout-link" onClick={handleLogout}>
                  <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0 }} />
                  <span className="dashboard-logout-text">Log out</span>
                </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
