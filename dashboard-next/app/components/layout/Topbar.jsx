'use client';

import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { TOP_NAV_ITEMS } from '../../dashboard/dashboardLayoutConfig';
import { cn } from '../../lib/utils';
import ThemeToggle from './ThemeToggle';

function isActive(pathname, href) {
  if (!href) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Topbar({
  title = '',
  subtitle = '',
  searchPlaceholder = 'Search...',
  showSearch = false,
  onSearchChange = null,
  searchValue = '',
  actions = null,
  rightContent = null,
  className = ''
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <section className={cn('dashboard-topbar dashboard-topbar-rich', className)}>
      <div className="dashboard-topbar-leading">
        <div className="dashboard-topbar-tabs">
          {TOP_NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`dashboard-topbar-tab ${isActive(pathname, item.href) ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {title || subtitle ? (
          <div className="dashboard-topbar-copy">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="dashboard-topbar-actions">
        {showSearch ? (
          <div className="dashboard-topbar-search dashboard-topbar-search-panel">
            <span className="dashboard-topbar-search-icon">⌕</span>
            <Input
              value={searchValue}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
            />
          </div>
        ) : null}

        {actions ? <div className="dashboard-topbar-action-group">{actions}</div> : null}

        {rightContent || (
          <>
            <ThemeToggle />
            <Button variant="ghost" className="dashboard-topbar-notify">Notifications</Button>
            <Button variant="ghost" className="dashboard-topbar-profile">
              <span className="dashboard-topbar-avatar">AK</span>
              <span>Akshay</span>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

export default Topbar;
