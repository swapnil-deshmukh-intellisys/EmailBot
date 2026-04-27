'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui-components/UiActionButton';
import Input from '../ui-components/UiTextInputField';
import { TOP_NAV_ITEMS } from '@/app/dashboard/DashboardNavigationLayoutConfig';
import { TEMP_LOGIN_ACCOUNTS } from '@/app/lib/dashboardRoles';
import { cn } from '@/app/lib/UiClassNameUtility';
import ThemeToggle from './SharedThemeToggleControl';

function isActive(pathname, href) {
  if (!href) return false;
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function displayNameFromEmail(email = '') {
  const tempAccount = TEMP_LOGIN_ACCOUNTS.find((item) => item.identifier === String(email || '').trim().toLowerCase());
  if (tempAccount?.label) return tempAccount.label;

  const localPart = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!localPart) return 'Profile';

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFromName(value = '') {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'US';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

export function Topbar({
  title = '',
  subtitle = '',
  searchPlaceholder = 'Search...',
  showSearch = false,
  showTabs = true,
  tabs = TOP_NAV_ITEMS,
  onSearchChange = null,
  searchValue = '',
  actions = null,
  rightContent = null,
  onOpenMobileSidebar = null,
  className = '',
  profile = null
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileName = profile?.name || displayNameFromEmail(profile?.email || '');
  const profileInitials = profile?.initials || initialsFromName(profileName);
  const profileEmail = profile?.email || '';
  const profileRole = profile?.role ? String(profile.role).replace(/_/g, ' ') : '';
  const profileAvatarDataUrl = profile?.avatarDataUrl || '';
  const profileActions = useMemo(() => profile?.actions || [], [profile]);
  const showProfileMenu = Boolean(profile && (profileActions.length || profileEmail || profileRole));

  return (
    <section className={cn('dashboard-topbar dashboard-topbar-rich', className)}>
      <div className="dashboard-topbar-leading">
        {showTabs ? (
          <div className="dashboard-topbar-tabs">
            {tabs.map((item) => (
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
        ) : null}
        {title || subtitle ? (
          <div className="dashboard-topbar-copy">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="dashboard-topbar-actions">
        <button
          type="button"
          className="dashboard-mobile-sidebar-toggle dashboard-mobile-sidebar-toggle-inline"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation menu"
        >
          ☰ Menu
        </button>
        {showSearch ? (
          <div className="dashboard-topbar-search dashboard-topbar-search-panel">
            <span className="dashboard-topbar-search-icon" aria-hidden="true">⌕</span>
            <Input value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
          </div>
        ) : null}

        {actions ? <div className="dashboard-topbar-action-group">{actions}</div> : null}

        {rightContent || (
          <>
            <ThemeToggle />
            <Button variant="ghost" className="dashboard-topbar-notify">Alerts</Button>
            {showProfileMenu ? (
              <div className="dashboard-topbar-profile-wrap" style={{ position: 'relative' }}>
                <Button variant="ghost" className="dashboard-topbar-profile" onClick={() => setProfileOpen((prev) => !prev)}>
                  {profileAvatarDataUrl ? (
                    <img className="dashboard-topbar-avatar dashboard-topbar-avatar-img" src={profileAvatarDataUrl} alt={profileName} />
                  ) : (
                    <span className="dashboard-topbar-avatar">{profileInitials}</span>
                  )}
                  <span>{profileName}</span>
                </Button>
                {profileOpen ? (
                  <div className="dashboard-topbar-dropdown-menu" style={{ minWidth: 240, right: 0 }}>
                    <div className="dashboard-topbar-dropdown-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                      <strong style={{ display: 'block' }}>{profileName}</strong>
                      {profileEmail ? <small style={{ display: 'block', color: 'rgba(15, 23, 42, 0.56)', marginTop: 2 }}>{profileEmail}</small> : null}
                      {profileRole ? <small style={{ display: 'block', color: 'rgba(15, 23, 42, 0.52)', marginTop: 2 }}>Role: {profileRole}</small> : null}
                    </div>
                    {profileActions.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`dashboard-topbar-dropdown-item ${item.tone === 'danger' ? 'add' : ''}`}
                        onClick={() => {
                          setProfileOpen(false);
                          item.onClick?.();
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <Button variant="ghost" className="dashboard-topbar-profile">
                <span className="dashboard-topbar-avatar">AK</span>
                <span>Akshay</span>
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Topbar;
