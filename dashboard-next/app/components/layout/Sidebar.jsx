'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui/Button';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS, TOP_NAV_ITEMS } from '../../dashboard/dashboardLayoutConfig';
import { cn } from '../../lib/utils';

const defaultNavItems = TOP_NAV_ITEMS.map((item) => ({ href: item.href, label: item.label }));

function isActive(pathname, href) {
  if (!href) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  navItems = defaultNavItems,
  brand = 'CODENAME.COM',
  brandHref = '/dashboard',
  footer = null,
  className = ''
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className={cn('dashboard-sidebar', className)}>
      <div className="dashboard-sidebar-card">
        <div className="dashboard-brand">
          <Link href={brandHref} className="dashboard-brand-link">
            <div className="dashboard-brand-mark">CD</div>
            <div>
              <h2>{brand}</h2>
              <p>Admin Workspace</p>
            </div>
          </Link>
        </div>

        <div className="dashboard-sidebar-stack">
          {SIDEBAR_PRIMARY_ITEMS.map((item) => (
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

        <div className="dashboard-sidebar-nav">
          <nav className="dashboard-sidebar-menu">
            {navItems.map((item) => {
              const matchingWorkspaceItem = SIDEBAR_WORKSPACE_ITEMS.find((workspaceItem) => workspaceItem.href === item.href || workspaceItem.label === item.label);
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
            <>
              <div className="dashboard-upgrade-card">
                <div className="dashboard-upgrade-head">
                  <strong>Upgrade</strong>
                  <span className="dashboard-upgrade-badge" aria-hidden="true">+</span>
                </div>
                <p className="dashboard-upgrade-plan">Basic</p>
                <p className="dashboard-upgrade-credits">1200 Credits Left</p>
                <div className="dashboard-upgrade-meter">
                  <span />
                </div>
                <Button className="dashboard-upgrade-button">Upgrade Plan</Button>
              </div>

              <Button variant="danger" className="dashboard-logout-link" onClick={() => router.push('/login')}>
                <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0 }} />
                <span aria-hidden="true" style={{ visibility: 'hidden' }}>Log out</span>
                <span className="dashboard-logout-text">Log out</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;






