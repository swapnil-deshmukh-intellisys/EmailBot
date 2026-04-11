'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS } from '../../dashboard/dashboardLayoutConfig';
import { cn } from '../../lib/utils';

const defaultNavItems = SIDEBAR_WORKSPACE_ITEMS.map((item) => ({ href: item.href, label: item.label }));

function isActive(pathname, href) {
  if (!href) return false;
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/dashboard/user';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  primaryItems = SIDEBAR_PRIMARY_ITEMS,
  navItems = defaultNavItems,
  brand = 'Intelli Mail Pilot',
  brandHref = '/dashboard',
  footer = null,
  mobileOpen = false,
  onMobileClose = null,
  showSearch = true,
  searchPlaceholder = 'Search',
  className = ''
}) {
  const [searchValue, setSearchValue] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
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
            <div className="dashboard-brand-mark">CD</div>
            <div>
              <h2>{brand}</h2>
            </div>
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
                  <strong>Upgrade</strong>
                  <span className="dashboard-upgrade-badge" aria-hidden="true">↻</span>
                </div>
                <p className="dashboard-upgrade-plan">Basic</p>
                <p className="dashboard-upgrade-credits">1200 Credits Left</p>
                <div className="dashboard-upgrade-meter">
                  <span />
                </div>
                <Button className="dashboard-upgrade-button">Upgrade Plan</Button>
              </div>

              <Button variant="danger" className="dashboard-logout-link" onClick={handleLogout}>
                <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0 }} />
                <span aria-hidden="true" style={{ visibility: 'hidden' }}>Log out</span>
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
