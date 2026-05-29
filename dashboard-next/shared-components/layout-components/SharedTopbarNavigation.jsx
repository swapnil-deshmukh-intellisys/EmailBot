'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '../ui-components/UiActionButton';
import Input from '../ui-components/UiTextInputField';
import { TOP_NAV_ITEMS } from '@/app/dashboard/DashboardNavigationLayoutConfig';
import { TEMP_LOGIN_ACCOUNTS } from '@/app/lib/dashboardRoles';
import { cn } from '@/app/lib/UiClassNameUtility';
import ThemeToggle from './SharedThemeToggleControl';

function formatDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isActive(pathname, href) {
  if (!href) return false;
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
  copyFooter = null,
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
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [uploadedAvatarDataUrl, setUploadedAvatarDataUrl] = useState('');
  const [selectedTopbarDate, setSelectedTopbarDate] = useState(() => formatDateInputValue());
  const profilePhotoInputRef = useRef(null);
  const shouldLoadProfile = !profile?.email && !profile?.identifier && !profile?.name && !profile?.displayName && !profile?.avatarDataUrl;
  const resolvedProfile = {
    ...(loadedProfile || {}),
    ...(profile || {}),
    avatarDataUrl: uploadedAvatarDataUrl || profile?.avatarDataUrl || loadedProfile?.avatarDataUrl || ''
  };
  const profileName =
    resolvedProfile?.name ||
    resolvedProfile?.displayName ||
    displayNameFromEmail(resolvedProfile?.email || resolvedProfile?.identifier || '');
  const profileInitials = profile?.initials || initialsFromName(profileName);
  const profileEmail = resolvedProfile?.email || resolvedProfile?.identifier || '';
  const profileRole = resolvedProfile?.role ? String(resolvedProfile.role).replace(/_/g, ' ') : '';
  const profileAvatarDataUrl = resolvedProfile?.avatarDataUrl || '';
  const profileActions = useMemo(() => resolvedProfile?.actions || [], [resolvedProfile]);
  const showProfileMenu = Boolean(resolvedProfile && (profileActions.length || profileEmail || profileRole));

  useEffect(() => {
    if (profile && !shouldLoadProfile) return;
    let active = true;
    fetch('/api/profile', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data?.profile) return;
        setLoadedProfile(data.profile);
      })
      .catch(() => {
        if (active) setLoadedProfile(null);
      });
    return () => {
      active = false;
    };
  }, [profile, shouldLoadProfile]);

  const handleProfilePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const avatarDataUrl = String(reader.result || '');
      setUploadedAvatarDataUrl(avatarDataUrl);
      setLoadedProfile((current) => ({ ...(current || {}), avatarName: file.name, avatarDataUrl }));
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarName: file.name, avatarDataUrl })
      }).catch(() => {});
    };
    reader.readAsDataURL(file);
  };

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
            {copyFooter ? <div className="dashboard-topbar-copy-footer">{copyFooter}</div> : null}
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
            <ThemeToggle buttonLabel="Select Theme" />
            <label className="dashboard-topbar-date-control">
              <span>Select Date</span>
              <input
                type="date"
                value={selectedTopbarDate}
                onChange={(event) => setSelectedTopbarDate(event.target.value || formatDateInputValue())}
                aria-label="Select dashboard date"
              />
            </label>
            <Button
              variant="ghost"
              className="dashboard-topbar-notify"
              onClick={() => router.push('/dashboard/user/profile#notifications')}
            >
              Notifications
            </Button>
            <Button
              variant="secondary"
              className="dashboard-topbar-profile-link"
              onClick={() => router.push('/dashboard/user/profile')}
            >
              Go to Profile
            </Button>
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
                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="dashboard-profile-photo-input"
                      onChange={handleProfilePhotoUpload}
                    />
                    <div className="dashboard-topbar-dropdown-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                      <strong style={{ display: 'block' }}>{profileName}</strong>
                      {profileEmail ? <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>{profileEmail}</small> : null}
                      {profileRole ? <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>Role: {profileRole}</small> : null}
                    </div>
                    <button
                      type="button"
                      className="dashboard-topbar-dropdown-item"
                      onClick={() => profilePhotoInputRef.current?.click()}
                    >
                      Add Profile Photo
                    </button>
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
                <span className="dashboard-topbar-avatar">{profileInitials}</span>
                <span>{profileName}</span>
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default Topbar;
