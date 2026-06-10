'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS } from '@/app/dashboard/DashboardNavigationLayoutConfig';
import { cn } from '@/app/lib/UiClassNameUtility';

const defaultNavItems = SIDEBAR_WORKSPACE_ITEMS.map((item) => ({ href: item.href, label: item.label, badge: item.badge }));

const sidebarIconMap = {
  Dashboard: 'ti-layout-dashboard',
  Leads: 'ti-users',
  'Draft & Templates': 'ti-file-text',
  Mailbox: 'ti-mail',
  'Sender Emails': 'ti-mail-plus',
  'Warm-Up': 'ti-flame',
  Campaigns: 'ti-speakerphone',
  Clients: 'ti-address-book',
  Reports: 'ti-chart-line',
  Report: 'ti-chart-line',
  Settings: 'ti-settings'
};

function isActive(pathname, href) {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sidebarIconClass(label = '') {
  return sidebarIconMap[label] || 'ti-circle';
}

export function Sidebar({
  primaryItems = SIDEBAR_PRIMARY_ITEMS,
  navItems = defaultNavItems,
  brand = 'IntelliMail',
  brandHref = '/dashboard/user',
  footer = null,
  mobileOpen = false,
  onMobileClose = null,
  showSearch = true,
  searchPlaceholder = 'Search anything...',
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
    <aside className={cn('dashboard-sidebar intellimail-sidebar', mobileOpen ? 'mobile-open' : '', className)}>
      <div className="dashboard-sidebar-card">
        <button
          type="button"
          className="dashboard-sidebar-close"
          onClick={onMobileClose}
          aria-label="Close navigation menu"
        >
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        <div className="sidebar-logo dashboard-brand reference-brand">
          <Link href={brandHref} className="dashboard-brand-link reference-brand-link" aria-label="Go to dashboard">
            <span className="logo-mark" aria-hidden="true"><i className="ti ti-mail-bolt" /></span>
            <span className="reference-brand-copy">
              <strong className="logo-text">{brand}</strong>
              <small className="logo-sub">MAIL PILOT</small>
            </span>
          </Link>
        </div>

        <div className="dashboard-sidebar-stack">
          {showSearch ? (
            <div className={`sidebar-search dashboard-sidebar-search ${searchValue ? 'active' : ''}`}>
              <div className="search-wrap">
                <i className="ti ti-search si-icon" aria-hidden="true" />
                <input
                  className="search-input"
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  aria-label="Search"
                  placeholder={searchPlaceholder}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="dashboard-sidebar-nav">
          <nav className="dashboard-sidebar-menu sidebar-nav">
            <div className="nav-section-label">Main</div>
            {primaryItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-item dashboard-primary-link ${item.tone || ''} ${isActive(pathname, item.href) ? 'active' : ''}`}
              >
                <i className={`ti ${sidebarIconClass(item.label)} dashboard-link-icon`} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            ))}

            <div className="nav-section-label">Workspace</div>
            {navItems.map((item) => (
              <div key={item.href || item.label} className="dashboard-sidebar-item">
                <Link
                  href={item.href}
                  className={`nav-item dashboard-sidebar-link ${isActive(pathname, item.href) ? 'active' : ''}`}
                >
                  <i className={`ti ${sidebarIconClass(item.label)} dashboard-link-icon soft`} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge ? <em className="dashboard-sidebar-badge nav-badge warm">{item.badge}</em> : null}
                </Link>
              </div>
            ))}
          </nav>

          {footer ? (
            <div className="dashboard-sidebar-footer sidebar-footer">{footer}</div>
          ) : (
            <div className="dashboard-sidebar-footer sidebar-footer">
              <div className="user-row reference-sidebar-user">
                <div className="user-avatar">AM</div>
                <div className="user-copy">
                  <strong className="user-name">Akshay More</strong>
                </div>
                <div className="user-actions">
                  <button type="button" className="icon-btn user-icon-btn" onClick={() => router.push('/dashboard/user/profile/settings')} aria-label="Settings">
                    <i className="ti ti-settings" aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn user-icon-btn" onClick={handleLogout} aria-label="Log out">
                    <i className="ti ti-logout" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
