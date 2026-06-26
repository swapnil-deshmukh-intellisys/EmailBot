'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TOP_NAV_ITEMS } from '@/app/dashboard/DashboardNavigationLayoutConfig';
import { TEMP_LOGIN_ACCOUNTS } from '@/app/lib/dashboardRoles';
import { cn } from '@/app/lib/UiClassNameUtility';

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
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'US';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

export function Topbar({
  title = '',
  subtitle = '',
  showTabs = true,
  tabs = TOP_NAV_ITEMS,
  actions = null,
  rightContent = null,
  onOpenMobileSidebar = null,
  className = '',
  profile = null
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [uploadedAvatarDataUrl, setUploadedAvatarDataUrl] = useState('');
  const profilePhotoInputRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const mobileFiltersRef = useRef(null);

  const shouldLoadProfile = !profile?.avatarDataUrl;
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

  const profileActions = useMemo(() => {
    const defaultActions = [
      { label: 'Profile', onClick: () => router.push('/dashboard/user/profile') },
      { label: 'Settings', onClick: () => router.push('/dashboard/user/profile/settings') },
      { label: 'Notifications', onClick: () => router.push('/dashboard/user/profile/notifications') },
      { label: 'Billing', onClick: () => router.push('/dashboard/user/profile/billing') },
      { label: 'Security', onClick: () => router.push('/dashboard/user/profile/security') }
    ];
    const customActions = Array.isArray(resolvedProfile?.actions) ? resolvedProfile.actions : [];
    const sourceActions = resolvedProfile?.replaceActions ? customActions : [...defaultActions, ...customActions];
    const seen = new Set();
    return sourceActions.filter((item) => {
      const key = String(item?.label || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [resolvedProfile, router]);

  useEffect(() => {
    if (!shouldLoadProfile) return;
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

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!profileDropdownRef.current?.contains(event.target)) setProfileOpen(false);
      if (!mobileFiltersRef.current?.contains(event.target)) setFiltersOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

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

  const handleLogout = async () => {
    setProfileOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  return (
    <header className={cn('topbar dashboard-topbar dashboard-topbar-rich intellimail-topbar', className)}>
      <button
        type="button"
        className="dashboard-mobile-sidebar-toggle dashboard-hamburger-button"
        onClick={onOpenMobileSidebar}
        aria-label="Open navigation menu"
      >
        <i className="ti ti-menu-2" aria-hidden="true" />
      </button>

      <div className="topbar-tabs dashboard-topbar-tabs">
        {showTabs ? tabs.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`tb-tab dashboard-topbar-tab ${isActive(pathname, item.href) ? 'active' : ''}`}
            onClick={() => router.push(item.href)}
          >
            {item.label}
          </button>
        )) : (
          <span className="dashboard-mobile-title">{title || subtitle || 'Dashboard'}</span>
        )}
      </div>

      <div className="topbar-actions dashboard-topbar-actions">
        <button
          type="button"
          className="dashboard-mobile-filter-toggle"
          onClick={() => setFiltersOpen((current) => !current)}
          aria-label="Open dashboard filters"
          aria-expanded={filtersOpen}
        >
          <i className="ti ti-adjustments-horizontal" aria-hidden="true" />
        </button>

        <div ref={mobileFiltersRef} className={`dashboard-topbar-filter-group ${filtersOpen ? 'open' : ''}`}>
          <select className="tb-select dashboard-topbar-date-select" defaultValue="">
            <option value="">Select Date</option>
          </select>
          <select className="tb-select dashboard-topbar-project-select" defaultValue="">
            <option value="">Select Project</option>
          </select>
          <select className="tb-select dashboard-topbar-sender-select" defaultValue="">
            <option value="">Select Sender</option>
          </select>
          {actions ? <div className="dashboard-topbar-action-group">{actions}</div> : null}
        </div>

        {rightContent || (
          <div className="dashboard-topbar-profile-wrap" ref={profileDropdownRef}>
            <button
              type="button"
              className="dashboard-topbar-profile"
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              {profileAvatarDataUrl ? (
                <img className="dashboard-topbar-avatar dashboard-topbar-avatar-img" src={profileAvatarDataUrl} alt={profileName} />
              ) : (
                <span className="dashboard-topbar-avatar">{profileInitials}</span>
              )}
              <span className="dashboard-topbar-profile-name">{profileName}</span>
            </button>
            {profileOpen ? (
              <div className="dashboard-topbar-dropdown-menu">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="dashboard-profile-photo-input"
                  onChange={handleProfilePhotoUpload}
                />
                <div className="dashboard-topbar-dropdown-item is-meta">
                  <strong>{profileName}</strong>
                  {profileEmail ? <small>{profileEmail}</small> : null}
                  {profileRole ? <small>Role: {profileRole}</small> : null}
                </div>
                <button type="button" className="dashboard-topbar-dropdown-item" onClick={() => profilePhotoInputRef.current?.click()}>
                  Add Profile Photo
                </button>
                {profileActions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="dashboard-topbar-dropdown-item"
                    onClick={() => {
                      setProfileOpen(false);
                      item.onClick?.();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                <button type="button" className="dashboard-topbar-dropdown-item logout" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;

