'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import { useTheme } from '@/shared-components/layout-components/ThemeProvider';

const PROFILE_SECTIONS = ['profile', 'security', 'preferences', 'notifications', 'activity', 'sessions', 'settings', 'billing', 'overview'];

function normalizeProfileSection(section) {
  return PROFILE_SECTIONS.includes(section) ? section : 'profile';
}

function profileSectionPath(section) {
  const safeSection = normalizeProfileSection(section);
  return safeSection === 'profile' ? '/dashboard/user/profile' : `/dashboard/user/profile/${safeSection}`;
}

function displayNameFromEmail(email = '') {
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

function formatDateTime(value, fallback = 'Not available') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatDate(value, fallback = 'Not set') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

function percent(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return '0%';
  return `${Math.round((top / bottom) * 10000) / 100}%`;
}

function fieldValue(...values) {
  for (const value of values) {
    const next = String(value ?? '').trim();
    if (next) return next;
  }
  return 'Not set';
}

function InfoField({ icon, label, value }) {
  return (
    <label className="imp-field">
      <span>{label}</span>
      <div>
        <i className={`ti ${icon}`} aria-hidden="true" />
        <input value={value || 'Not set'} readOnly />
      </div>
    </label>
  );
}

function SummaryRow({ label, value, status }) {
  return (
    <div className="imp-summary-row">
      <span>{label}</span>
      {status ? <strong className="imp-status-pill">{value}</strong> : <strong>{value}</strong>}
    </div>
  );
}

export default function UserProfilePage({ initialSection = 'profile' }) {
  const { theme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState(normalizeProfileSection(initialSection));
  const [profile, setProfile] = useState({});
  const [sessionUser, setSessionUser] = useState({});
  const [creditSummary, setCreditSummary] = useState({ totalCredits: 300, usedCredits: 0, remainingCredits: 300, creditUsagePercent: 0 });
  const [overview, setOverview] = useState({ totals: {}, projects: [], connectedMailIds: [], recentCampaigns: [] });
  const [accounts, setAccounts] = useState([]);
  const [mailboxCounts, setMailboxCounts] = useState({ total: 0, unread: 0, read: 0, junk: 0 });
  const [notificationPrefs, setNotificationPrefs] = useState({ campaignUpdates: true, replyAlerts: true, weeklyReports: true });
  const [workspaceSettings, setWorkspaceSettings] = useState({ density: 'comfortable', reducedMotion: false, defaultSendMode: 'scheduled' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveSection(normalizeProfileSection(initialSection));
  }, [initialSection]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('mailpilot:workspace-settings') || '{}');
      setWorkspaceSettings((current) => ({ ...current, ...stored }));
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ui-density-compact', workspaceSettings.density === 'compact');
    root.classList.toggle('ui-reduced-motion', Boolean(workspaceSettings.reducedMotion));
  }, [workspaceSettings.density, workspaceSettings.reducedMotion]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const [meRes, accountsRes, creditsRes, overviewRes, mailboxRes] = await Promise.all([
          fetch('/api/auth/me', { signal: controller.signal }),
          fetch('/api/accounts?owned=1', { signal: controller.signal }).catch(() => null),
          fetch('/api/credits', { signal: controller.signal }).catch(() => null),
          fetch('/api/profile/overview', { signal: controller.signal }).catch(() => null),
          fetch('/api/mailbox-folders', { signal: controller.signal }).catch(() => null)
        ]);

        if (meRes.ok) {
          const me = await meRes.json().catch(() => null);
          const savedProfile = me?.profile || {};
          setSessionUser(me?.user || {});
          setProfile(savedProfile);
          setNotificationPrefs({
            campaignUpdates: Boolean(savedProfile.notificationPrefs?.campaignUpdates ?? true),
            replyAlerts: Boolean(savedProfile.notificationPrefs?.replyAlerts ?? true),
            weeklyReports: Boolean(savedProfile.notificationPrefs?.weeklyReports ?? true)
          });
        }

        if (accountsRes?.ok) {
          const data = await accountsRes.json().catch(() => null);
          setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
        }

        if (creditsRes?.ok) {
          const data = await creditsRes.json().catch(() => null);
          if (data?.ok) {
            setCreditSummary(data.summary || {});
          }
        }

        if (overviewRes?.ok) {
          const data = await overviewRes.json().catch(() => null);
          if (data?.ok) setOverview(data);
        }

        if (mailboxRes?.ok) {
          const data = await mailboxRes.json().catch(() => null);
          const counts = data?.mailCounts || data?.folderCounts || {};
          setMailboxCounts({
            total: Number(counts.total || 0),
            unread: Number(counts.unread || 0),
            read: Number(counts.read || 0),
            junk: Number(counts.junk || counts.spam || 0)
          });
        }
      } catch (error) {
        if (error?.name !== 'AbortError') setMessage('Profile data could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const email = fieldValue(profile.email, sessionUser.email, profile.identifier, sessionUser.identifier);
  const displayName = fieldValue(profile.displayName, profile.name, sessionUser.name, displayNameFromEmail(email));
  const roleLabel = fieldValue(profile.role, sessionUser.role, 'User').replace(/_/g, ' ');
  const employeeId = fieldValue(profile.employeeId, sessionUser.employeeId, sessionUser.intellisysUserId, profile.intellisysUserId);
  const phoneNumber = fieldValue(profile.phoneNumber, profile.phone, profile.mobile, profile.contactNumber);
  const locationText = fieldValue(profile.location, [profile.city, profile.state, profile.country].filter(Boolean).join(', '));
  const dateOfBirth = formatDate(profile.dateOfBirth || profile.dob || profile.birthDate);
  const timeZone = fieldValue(profile.timezone, profile.timeZone, '(GMT +05:30) Asia/Kolkata');
  const department = fieldValue(profile.department, profile.team, roleLabel.toLowerCase().includes('admin') ? 'Management' : 'Operations');
  const lastIpAddress = fieldValue(profile.lastIpAddress, profile.lastIp, sessionUser.lastIpAddress, 'Not available');
  const statusLabel = fieldValue(profile.status, sessionUser.status, 'active');
  const avatarDataUrl = String(profile.avatarDataUrl || '').trim();
  const initials = initialsFromName(displayName);
  const totals = overview.totals || {};
  const totalCredits = Number(creditSummary.totalCredits || profile.totalCredits || 0);
  const usedCredits = Number(creditSummary.usedCredits || profile.usedCredits || 0);
  const remainingCredits = Number(creditSummary.remainingCredits ?? Math.max(0, totalCredits - usedCredits));
  const creditPercent = Math.max(0, Math.min(100, Number(creditSummary.creditUsagePercent || (totalCredits ? (usedCredits / totalCredits) * 100 : 0))));
  const activeAccounts = useMemo(() => {
    const direct = accounts.map((account) => ({
      id: String(account.id || account._id || account.from || ''),
      email: account.from || account.email,
      provider: account.provider || account.label || 'SMTP',
      status: account.status || 'Active',
      updatedAt: account.updatedAt || account.createdAt
    }));
    const connected = (overview.connectedMailIds || []).map((account) => ({
      id: String(account.id || account.email || ''),
      email: account.email,
      provider: account.provider || 'Connected mail',
      status: account.status || 'Active',
      updatedAt: account.updatedAt
    }));
    const byEmail = new Map();
    [...direct, ...connected].filter((item) => item.email).forEach((item) => byEmail.set(String(item.email).toLowerCase(), item));
    return Array.from(byEmail.values());
  }, [accounts, overview.connectedMailIds]);

  const stats = [
    { icon: 'ti-send', label: 'Total Campaigns', value: formatNumber(totals.campaigns) },
    { icon: 'ti-users', label: 'Total Clients', value: formatNumber(totals.lists) },
    { icon: 'ti-mail', label: 'Emails Sent', value: formatNumber(totals.sent) },
    { icon: 'ti-arrow-back-up', label: 'Replies Received', value: formatNumber(totals.replies) },
    { icon: 'ti-eye', label: 'Open Rate', value: percent(totals.opens, totals.sent) },
    { icon: 'ti-pointer', label: 'Click Rate', value: percent(totals.replies, totals.sent) }
  ];

  const tabs = [
    { id: 'profile', label: 'Profile Information', icon: 'ti-user' },
    { id: 'security', label: 'Account & Security', icon: 'ti-lock' },
    { id: 'preferences', label: 'Preferences', icon: 'ti-settings' },
    { id: 'notifications', label: 'Email Notifications', icon: 'ti-mail' },
    { id: 'activity', label: 'Activity Log', icon: 'ti-history' },
    { id: 'sessions', label: 'Sessions', icon: 'ti-device-desktop' }
  ];

  const topbarActions = [
    { label: 'Profile', onClick: () => { window.location.href = profileSectionPath('profile'); } },
    { label: 'Overview', onClick: () => { window.location.href = profileSectionPath('overview'); } },
    { label: 'Settings', onClick: () => { window.location.href = profileSectionPath('settings'); } },
    { label: 'Notifications', onClick: () => { window.location.href = profileSectionPath('notifications'); } },
    { label: 'Billing', onClick: () => { window.location.href = profileSectionPath('billing'); } },
    { label: 'Security', onClick: () => { window.location.href = profileSectionPath('security'); } }
  ];

  const saveWorkspaceSettings = () => {
    try {
      window.localStorage.setItem('mailpilot:workspace-settings', JSON.stringify(workspaceSettings));
      setMessage('Preferences saved.');
    } catch {
      setMessage('Preferences could not be saved in this browser.');
    }
  };

  const toggleNotificationPref = (key) => {
    setNotificationPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPrefs: next })
      }).catch(() => {});
      return next;
    });
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const avatarDataUrl = String(reader.result || '');
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarName: file.name, avatarDataUrl })
      }).catch(() => {});
      setProfile((current) => ({ ...current, avatarName: file.name, avatarDataUrl }));
      setMessage('Profile photo saved.');
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async () => {
    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwordForm)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error || 'Password change failed.');
      return;
    }
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage('Password updated successfully.');
  };

  const renderAvatar = (className) => (
    avatarDataUrl ? <img className={`${className} imp-avatar-img`} src={avatarDataUrl} alt={displayName} /> : <span className={className}>{initials}</span>
  );

  return (
    <AppLayout
      topbarProps={{
        title: 'Profile',
        profile: {
          email,
          role: roleLabel,
          name: displayName,
          initials,
          avatarDataUrl,
          replaceActions: true,
          actions: topbarActions
        }
      }}
    >
      <section className="intellimail-profile-page">
        <div className="imp-heading-row">
          <div>
            <div className="imp-breadcrumb"><span>Home</span><i className="ti ti-chevron-right" aria-hidden="true" /><strong>Profile</strong></div>
            <h1>My Profile</h1>
            <p>Manage your profile information, preferences and security settings.</p>
          </div>
          <button type="button" className="imp-edit-button" onClick={() => setMessage('Profile editing uses your connected database profile.') }>
            <i className="ti ti-pencil" aria-hidden="true" /> Edit Profile
          </button>
        </div>

        <article className="imp-hero-card">
          <div className="imp-identity-block">
            <div className="imp-photo-wrap">
              {renderAvatar('imp-main-avatar')}
              <label className="imp-photo-edit" aria-label="Change profile photo">
                <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                <i className="ti ti-pencil" aria-hidden="true" />
              </label>
            </div>
            <div className="imp-identity-copy">
              <div className="imp-name-row"><h2>{displayName}</h2><i className="ti ti-rosette-discount-check-filled" aria-hidden="true" /></div>
              <span className="imp-role-badge">{roleLabel}</span>
              <ul>
                <li><i className="ti ti-mail" aria-hidden="true" /> {email}</li>
                <li><i className="ti ti-phone" aria-hidden="true" /> {phoneNumber}</li>
                <li><i className="ti ti-map-pin" aria-hidden="true" /> {locationText}</li>
                <li><i className="ti ti-calendar" aria-hidden="true" /> Joined on {formatDateTime(profile.createdAt || sessionUser.createdAt, 'Not available')}</li>
              </ul>
            </div>
          </div>

          <div className="imp-stat-grid" aria-busy={loading}>
            {stats.map((stat) => (
              <div className="imp-stat-item" key={stat.label}>
                <span className="imp-stat-icon"><i className={`ti ${stat.icon}`} aria-hidden="true" /></span>
                <div><small>{stat.label}</small><strong>{stat.value}</strong></div>
              </div>
            ))}
          </div>
        </article>

        <article className="imp-tabs-card">
          <nav className="imp-tabs" aria-label="Profile sections">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={activeSection === tab.id ? 'active' : ''} onClick={() => setActiveSection(tab.id)}>
                <i className={`ti ${tab.icon}`} aria-hidden="true" /> {tab.label}
              </button>
            ))}
          </nav>

          {activeSection === 'profile' ? (
            <div className="imp-content-grid">
              <section className="imp-panel imp-form-panel">
                <h3>Personal Information</h3>
                <div className="imp-field-grid">
                  <InfoField icon="ti-user" label="Full Name" value={displayName} />
                  <InfoField icon="ti-mail" label="Email Address" value={email} />
                  <InfoField icon="ti-phone" label="Phone Number" value={phoneNumber} />
                  <InfoField icon="ti-map-pin" label="Location" value={locationText} />
                  <InfoField icon="ti-calendar" label="Date of Birth" value={dateOfBirth} />
                  <InfoField icon="ti-world" label="Time Zone" value={timeZone} />
                </div>

                <div className="imp-divider" />
                <h3>Professional Information</h3>
                <div className="imp-professional-grid">
                  <InfoField icon="ti-shield-star" label="Role" value={roleLabel} />
                  <InfoField icon="ti-building" label="Department" value={department} />
                  <InfoField icon="ti-id-badge-2" label="Employee ID" value={employeeId} />
                </div>
              </section>

              <aside className="imp-side-stack">
                <section className="imp-panel imp-summary-panel">
                  <h3>Profile Summary</h3>
                  <p>{roleLabel} with full access to all modules and settings. You can manage users, projects, campaigns, clients, templates, and system configurations.</p>
                  <SummaryRow label="Login Email" value={email} />
                  <SummaryRow label="Role" value={roleLabel} />
                  <SummaryRow label="Access Level" value={roleLabel.toLowerCase().includes('admin') ? 'Full Access' : 'Assigned Access'} />
                  <SummaryRow label="Last Login" value={formatDateTime(profile.lastLoginAt || sessionUser.lastLoginAt)} />
                  <SummaryRow label="Last IP Address" value={lastIpAddress} />
                  <SummaryRow label="Account Status" value={statusLabel} status />
                </section>

                <section className="imp-panel imp-photo-panel">
                  <h3>Change Profile Photo <i className="ti ti-info-circle" aria-hidden="true" /></h3>
                  <div className="imp-upload-row">
                    {renderAvatar('imp-upload-avatar')}
                    <div>
                      <label className="imp-upload-button">
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                        <i className="ti ti-upload" aria-hidden="true" /> Upload New Photo
                      </label>
                      <small>{profile.avatarName || 'JPG, PNG or GIF. Max size 2MB'}</small>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          ) : null}


          {activeSection === 'overview' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Overview</h3>
                <div className="imp-overview-grid">
                  <SummaryRow label="Total Campaigns" value={formatNumber(totals.campaigns)} />
                  <SummaryRow label="Total Clients" value={formatNumber(totals.lists)} />
                  <SummaryRow label="Emails Sent" value={formatNumber(totals.sent)} />
                  <SummaryRow label="Replies Received" value={formatNumber(totals.replies)} />
                  <SummaryRow label="Open Rate" value={percent(totals.opens, totals.sent)} />
                  <SummaryRow label="Click Rate" value={percent(totals.replies, totals.sent)} />
                </div>
                <div className="imp-activity-list imp-overview-list">
                  {(overview.recentCampaigns || []).slice(0, 6).map((campaign) => (
                    <article key={campaign.id || campaign.name}>
                      <i className="ti ti-speakerphone" aria-hidden="true" />
                      <div><strong>{campaign.name || 'Campaign'}</strong><small>{campaign.status || 'Draft'} - {campaign.projectName || 'Default project'} - {formatDateTime(campaign.updatedAt)}</small></div>
                    </article>
                  ))}
                  {!overview.recentCampaigns?.length ? <p className="imp-muted">No overview activity yet.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {activeSection === 'billing' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Billing</h3>
                <div className="imp-overview-grid">
                  <SummaryRow label="Current Plan" value={fieldValue(profile.planName, creditSummary.planName, 'Basic')} />
                  <SummaryRow label="Total Credits" value={formatNumber(totalCredits)} />
                  <SummaryRow label="Used Credits" value={formatNumber(usedCredits)} />
                  <SummaryRow label="Remaining Credits" value={formatNumber(remainingCredits)} />
                  <SummaryRow label="Usage" value={`${Math.round(creditPercent)}%`} />
                  <SummaryRow label="Account Status" value={statusLabel} status />
                </div>
                <div className="imp-credit-card">
                  <div><span>Credits</span><strong>{formatNumber(remainingCredits)} / {formatNumber(totalCredits)}</strong></div>
                  <div className="imp-credit-track"><i style={{ width: `${creditPercent}%` }} /></div>
                  <small>{Math.round(creditPercent)}% used this cycle.</small>
                </div>
              </section>
            </div>
          ) : null}
          {activeSection === 'security' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Account & Security</h3>
                <div className="imp-security-grid">
                  <SummaryRow label="Status" value={statusLabel} status />
                  <SummaryRow label="Password Changed" value={formatDateTime(profile.passwordChangedAt)} />
                  <SummaryRow label="First Login" value={profile.isFirstLogin ? 'Yes' : 'No'} />
                  <SummaryRow label="Connected Mail IDs" value={formatNumber(activeAccounts.length)} />
                </div>
                <div className="imp-password-grid">
                  <input type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                  <input type="password" placeholder="New password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                  <input type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                </div>
                <button type="button" className="imp-primary-button" onClick={handlePasswordChange}><i className="ti ti-lock-check" aria-hidden="true" /> Update Password</button>
              </section>
            </div>
          ) : null}

          {(activeSection === 'preferences' || activeSection === 'settings') ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Preferences</h3>
                <div className="imp-preference-grid">
                  {['light', 'dark', 'colorful'].map((option) => (
                    <button key={option} type="button" className={theme === option ? 'active' : ''} onClick={() => setTheme(option)}>
                      <i className={`ti ${option === 'light' ? 'ti-sun' : option === 'dark' ? 'ti-moon' : 'ti-color-swatch'}`} aria-hidden="true" />
                      <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                    </button>
                  ))}
                </div>
                <div className="imp-setting-row">
                  <span><strong>Interface density</strong><small>Choose comfortable or compact dashboard spacing.</small></span>
                  <select value={workspaceSettings.density} onChange={(event) => setWorkspaceSettings((current) => ({ ...current, density: event.target.value }))}>
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
                <div className="imp-setting-row">
                  <span><strong>Default send mode</strong><small>Used when creating new campaigns.</small></span>
                  <select value={workspaceSettings.defaultSendMode} onChange={(event) => setWorkspaceSettings((current) => ({ ...current, defaultSendMode: event.target.value }))}>
                    <option value="scheduled">Schedule for later</option>
                    <option value="send_now">Send now</option>
                  </select>
                </div>
                <label className="imp-toggle-row"><span><strong>Reduce motion</strong><small>Minimize dashboard animation.</small></span><input type="checkbox" checked={workspaceSettings.reducedMotion} onChange={(event) => setWorkspaceSettings((current) => ({ ...current, reducedMotion: event.target.checked }))} /></label>
                <button type="button" className="imp-primary-button" onClick={saveWorkspaceSettings}><i className="ti ti-device-floppy" aria-hidden="true" /> Save Preferences</button>
              </section>
            </div>
          ) : null}

          {activeSection === 'notifications' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Email Notifications</h3>
                {[
                  ['campaignUpdates', 'Campaign updates', 'Receive status changes for campaign runs.'],
                  ['replyAlerts', 'Reply alerts', 'Get notified when prospects reply.'],
                  ['weeklyReports', 'Weekly reports', 'Receive weekly performance summaries.']
                ].map(([key, title, copy]) => (
                  <label className="imp-toggle-row" key={key}>
                    <span><strong>{title}</strong><small>{copy}</small></span>
                    <input type="checkbox" checked={Boolean(notificationPrefs[key])} onChange={() => toggleNotificationPref(key)} />
                  </label>
                ))}
              </section>
            </div>
          ) : null}

          {activeSection === 'activity' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Activity Log</h3>
                <div className="imp-activity-list">
                  {(overview.recentCampaigns || []).slice(0, 8).map((campaign) => (
                    <article key={campaign.id || campaign.name}>
                      <i className="ti ti-speakerphone" aria-hidden="true" />
                      <div><strong>{campaign.name || 'Campaign'}</strong><small>{campaign.status || 'Draft'} - {campaign.projectName || 'Default project'} - {formatDateTime(campaign.updatedAt)}</small></div>
                    </article>
                  ))}
                  {!overview.recentCampaigns?.length ? <p className="imp-muted">No recent campaign activity yet.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {activeSection === 'sessions' ? (
            <div className="imp-content-grid imp-single-grid">
              <section className="imp-panel">
                <h3>Sessions</h3>
                <div className="imp-session-grid">
                  {activeAccounts.length ? activeAccounts.map((account) => (
                    <article key={account.id || account.email}>
                      <i className="ti ti-mail-check" aria-hidden="true" />
                      <div><strong>{account.email}</strong><small>{account.provider} - {account.status} - {formatDateTime(account.updatedAt)}</small></div>
                    </article>
                  )) : <p className="imp-muted">No connected mail sessions found.</p>}
                </div>
                <div className="imp-credit-card">
                  <div><span>Credits</span><strong>{formatNumber(remainingCredits)} / {formatNumber(totalCredits)}</strong></div>
                  <div className="imp-credit-track"><i style={{ width: `${creditPercent}%` }} /></div>
                  <small>{Math.round(creditPercent)}% used this cycle. Mailbox total: {formatNumber(mailboxCounts.total)}.</small>
                </div>
              </section>
            </div>
          ) : null}

          {message ? <p className="imp-message">{message}</p> : null}
        </article>
      </section>
    </AppLayout>
  );
}







