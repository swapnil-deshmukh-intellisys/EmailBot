'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';

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
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'US';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function formatDateTime(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function UserProfilePage() {
  const [profile, setProfile] = useState({ email: '', role: '', displayName: '', avatarName: '', avatarDataUrl: '', planName: 'Basic', notificationPrefs: {} });
  const [creditSummary, setCreditSummary] = useState({ totalCredits: 6000, usedCredits: 0, remainingCredits: 6000, creditUsagePercent: 0 });
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [counts, setCounts] = useState({ campaigns: 0, lists: 0, mails: 0 });
  const [accounts, setAccounts] = useState([]);
  const [profilePhotoName, setProfilePhotoName] = useState('');
  const [profileAvatarDataUrl, setProfileAvatarDataUrl] = useState('');
  const [profileNotificationPrefs, setProfileNotificationPrefs] = useState({
    campaignUpdates: true,
    replyAlerts: true,
    weeklyReports: true
  });
  const [profilePasswordForm, setProfilePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('profile');
  const [selectedConnectedAccount, setSelectedConnectedAccount] = useState(null);
  const [showCreditHistory, setShowCreditHistory] = useState(false);

  const profileDisplayName = profile.displayName || displayNameFromEmail(profile.email);
  const profileInitials = initialsFromName(profileDisplayName);
  const profileRoleLabel = profile.role ? String(profile.role).replace(/_/g, ' ') : 'User';
  const lowCreditWarning = Number(creditSummary.remainingCredits || 0) > 0 && Number(creditSummary.creditUsagePercent || 0) >= 80;
  const billingUpgradeTarget = String(creditSummary.upgradeTargetPlan || '').trim();
  const hasUpgrade = billingUpgradeTarget && billingUpgradeTarget !== String(profile.planName || 'Basic').trim();
  const connectedAccounts = useMemo(() => accounts.slice(0, 3), [accounts]);
  const accountSummary = (account) => ({
    provider: String(account?.provider || '').trim() || 'Connected inbox',
    status: String(account?.status || '').trim() || 'Active',
    type: String(account?.label || '').trim() || 'Workspace account',
    lastSync: formatDateTime(account?.lastSync || account?.updatedAt || account?.createdAt),
    dailyLimit: String(account?.dailyLimit || '').trim() || '250',
    sentToday: String(account?.sentToday || '').trim() || '18',
    errors: String(account?.errors || '').trim() || '0',
    health: String(account?.health || '').trim() || 'Good'
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        let accountsData = null;
        const [meRes, accountsRes, campaignsRes, listsRes, creditsRes] = await Promise.all([
          fetch('/api/auth/me', { signal: controller.signal }),
          fetch('/api/accounts', { signal: controller.signal }),
          fetch('/api/campaigns', { signal: controller.signal }).catch(() => null),
          fetch('/api/lists', { signal: controller.signal }).catch(() => null),
          fetch('/api/credits', { signal: controller.signal }).catch(() => null)
        ]);

        if (meRes.ok) {
          const me = await meRes.json().catch(() => null);
          const user = me?.user || {};
          const saved = me?.profile || {};
          setProfile({
            email: String(user.email || '').trim(),
            role: String(user.role || '').trim(),
            displayName: String(saved.displayName || '').trim(),
            avatarName: String(saved.avatarName || '').trim(),
            avatarDataUrl: String(saved.avatarDataUrl || '').trim(),
            planName: String(saved.planName || 'Basic').trim() || 'Basic',
            notificationPrefs: saved.notificationPrefs || {}
          });
          setProfilePhotoName(String(saved.avatarName || '').trim());
          setProfileAvatarDataUrl(String(saved.avatarDataUrl || '').trim());
          setProfileNotificationPrefs({
            campaignUpdates: Boolean(saved.notificationPrefs?.campaignUpdates ?? true),
            replyAlerts: Boolean(saved.notificationPrefs?.replyAlerts ?? true),
            weeklyReports: Boolean(saved.notificationPrefs?.weeklyReports ?? true)
          });
        }

        if (accountsRes.ok) {
          accountsData = await accountsRes.json().catch(() => null);
          setAccounts(accountsData?.accounts || []);
        }

        const campaignsData = campaignsRes?.ok ? await campaignsRes.json().catch(() => null) : null;
        const listsData = listsRes?.ok ? await listsRes.json().catch(() => null) : null;
        const creditsData = creditsRes?.ok ? await creditsRes.json().catch(() => null) : null;
        setCounts({
          campaigns: Array.isArray(campaignsData?.campaigns) ? campaignsData.campaigns.length : 0,
          lists: Array.isArray(listsData?.lists) ? listsData.lists.length : 0,
          mails: Array.isArray(accountsData?.accounts) ? accountsData.accounts.length : 0
        });
        if (creditsData?.ok) {
          setCreditSummary(creditsData.summary || { totalCredits: 6000, usedCredits: 0, remainingCredits: 6000, creditUsagePercent: 0 });
          setCreditTransactions(Array.isArray(creditsData.transactions) ? creditsData.transactions : []);
          if (creditsData.summary?.planName) {
            setProfile((current) => ({
              ...current,
              planName: String(creditsData.summary.planName || current.planName || 'Basic')
            }));
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setMessage('Profile data could not be loaded.');
        }
      }
    };

    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateActiveSection = () => {
      const hash = window.location.hash.replace('#', '').trim();
      setActiveSection(hash || 'profile');
    };
    const scrollToSection = () => {
      const hash = window.location.hash.replace('#', '').trim() || 'profile';
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    updateActiveSection();
    scrollToSection();
    window.addEventListener('hashchange', updateActiveSection);
    window.addEventListener('hashchange', scrollToSection);
    return () => {
      window.removeEventListener('hashchange', updateActiveSection);
      window.removeEventListener('hashchange', scrollToSection);
    };
  }, []);

  const toggleNotificationPref = async (key) => {
    setProfileNotificationPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPrefs: next })
      }).catch(() => {});
      return next;
    });
  };

  const handlePhotoUpload = async (event) => {
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
      setProfilePhotoName(file.name);
      setProfileAvatarDataUrl(avatarDataUrl);
      setMessage('Profile photo saved.');
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async () => {
    const res = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profilePasswordForm)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error || 'Password change failed.');
      return;
    }
    setProfilePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage('Password updated successfully.');
  };

  const handleUpgradePlan = async () => {
    if (!hasUpgrade) {
      setMessage('Your plan is already at the highest tier.');
      return;
    }
    try {
      const nextPlanName = billingUpgradeTarget;
      const nextPlanCredits = Number(creditSummary.upgradeTargetCredits || (profile.planName === 'Basic' ? 12000 : 30000));
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: nextPlanName,
          totalCredits: nextPlanCredits
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(data?.error || 'Plan upgrade failed.');
        return;
      }
      if (data?.profile) {
        setProfile((current) => ({
          ...current,
          planName: String(data.profile.planName || current.planName || 'Basic'),
          notificationPrefs: data.profile.notificationPrefs || current.notificationPrefs
        }));
        setCreditSummary({
          planName: String(data.profile.planName || creditSummary.planName || 'Basic'),
          upgradeTargetPlan: String(data.profile.planName === 'Basic' ? 'Pro' : data.profile.planName === 'Pro' ? 'Enterprise' : ''),
          upgradeTargetCredits: Number(data.profile.planName === 'Basic' ? 12000 : data.profile.planName === 'Pro' ? 30000 : data.profile.totalCredits || 0),
          totalCredits: Number(data.profile.totalCredits || creditSummary.totalCredits || 6000),
          usedCredits: Number(data.profile.usedCredits || creditSummary.usedCredits || 0),
          remainingCredits: Number(data.profile.remainingCredits || creditSummary.remainingCredits || 0),
          creditUsagePercent: Number(data.profile.creditUsagePercent || creditSummary.creditUsagePercent || 0)
        });
      }
      setMessage(data?.message || 'Plan upgraded successfully.');
    } catch (error) {
      setMessage('Plan upgrade failed.');
    }
  };

  const handleOpenBilling = () => {
    window.location.hash = '#billing';
    setMessage('Billing section opened.');
  };

  const handleDownloadInvoice = async () => {
    try {
      const res = await fetch('/api/billing/invoice', { method: 'GET' });
      if (!res.ok) {
        setMessage('Invoice download failed.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mailbot-invoice-${(profile.email || 'profile').split('@')[0] || 'profile'}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage('Invoice downloaded.');
    } catch (error) {
      setMessage('Invoice download failed.');
    }
  };

  const handleDisconnect = async (account) => {
    await fetch(`/api/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' }).catch(() => {});
    setAccounts((current) => current.filter((item) => item.id !== account.id));
    setMessage(`Disconnected ${account.from}.`);
  };

  const profileActions = [
    { label: 'Profile', href: '#profile' },
    { label: 'Settings', href: '#settings' },
    { label: 'Notifications', href: '#notifications' },
    { label: 'Billing', href: '#billing' },
    { label: 'Security', href: '#security' }
  ];
  const sectionLinks = profileActions.map((item) => ({ ...item, label: item.label }));
  const sectionLabelMap = {
    profile: 'Profile overview',
    settings: 'Settings',
    notifications: 'Notifications',
    billing: 'Billing',
    security: 'Security'
  };
  const activeSectionLabel = sectionLabelMap[activeSection] || 'Profile overview';
  const activeSectionTone = {
    profile: 'tone-profile',
    settings: 'tone-settings',
    notifications: 'tone-notifications',
    billing: 'tone-billing',
    security: 'tone-security'
  }[activeSection] || 'tone-profile';

  return (
    <AppLayout
      topbarProps={{
        title: 'Profile',
        subtitle: 'Your account summary, preferences, and quick actions.',
        profile: {
            email: profile.email,
            role: profile.role,
            name: profileDisplayName,
            initials: profileInitials,
          avatarDataUrl: profileAvatarDataUrl,
          actions: profileActions.map((item) => ({ label: item.label, onClick: () => { window.location.hash = item.href; } }))
        }
      }}
    >
      <section className="dashboard-profile-page">
        <div className={`dashboard-profile-page-label ${activeSection ? 'is-active' : ''} ${activeSectionTone}`}>{activeSectionLabel}</div>
        <aside className="dashboard-profile-side">
          <div className="dashboard-profile-side-hero" id="profile">
            <label className="dashboard-profile-upload dashboard-profile-upload-large">
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
              <span>Change Photo</span>
            </label>
            {profileAvatarDataUrl ? (
              <img className="dashboard-profile-avatar-lg dashboard-profile-avatar-img" src={profileAvatarDataUrl} alt={profileDisplayName} />
            ) : (
              <span className="dashboard-profile-avatar-lg">{profileInitials}</span>
            )}
            <strong>{profileDisplayName}</strong>
            <p>{profile.email || 'Signed in user'}</p>
            <small>Role: {profileRoleLabel}</small>
            {profilePhotoName ? <small>Photo: {profilePhotoName}</small> : null}
          </div>

          <nav className="dashboard-profile-nav" aria-label="Profile sections">
            {sectionLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`dashboard-profile-nav-item ${activeSection === item.href.replace('#', '') ? 'active' : ''} ${activeSection === item.href.replace('#', '') ? activeSectionTone : ''}`}
                onClick={() => {
                  window.location.hash = item.href;
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <article className={`dashboard-profile-card dashboard-profile-card-compact ${activeSection === 'profile' ? 'tone-profile' : ''}`}>
            <strong>Account Stats</strong>
            <p>Quick snapshot of your dashboard usage and active workspace activity.</p>
            <div className="dashboard-profile-stats">
              <span><strong>{counts.campaigns}</strong><small>Campaigns</small></span>
              <span><strong>{counts.lists}</strong><small>Lists</small></span>
              <span><strong>{counts.mails}</strong><small>Mails</small></span>
            </div>
          </article>
        </aside>

        <main className="dashboard-profile-main">
          <article className="dashboard-profile-card dashboard-profile-intro-card">
            <strong>Profile</strong>
            <p>Your account summary, preferences, and quick actions.</p>
          </article>

          <article className={`dashboard-profile-card ${activeSection === 'profile' ? 'tone-profile' : ''}`}>
            <strong>Connected Accounts</strong>
            <p>Review the mail accounts connected to your workspace.</p>
            <div className="dashboard-profile-chip-row">
              {connectedAccounts.length ? connectedAccounts.map((account) => (
                <span key={account.id || account.from} className="dashboard-profile-chip">{account.from}</span>
              )) : <span className="dashboard-profile-chip">{profile.email || 'No connected accounts'}</span>}
            </div>
            <p className="dashboard-profile-note">Connect or disconnect sender inboxes from the same workspace view.</p>
            <div className="dashboard-profile-mini-metrics">
              {connectedAccounts.length ? connectedAccounts.map((account) => {
                const summary = accountSummary(account);
                return (
                  <article key={`${account.id || account.from}-metrics`}>
                    <span>{summary.provider}</span>
                    <strong>{summary.status}</strong>
                    <small>{summary.lastSync}</small>
                    <small>{summary.sentToday} sent today · {summary.health}</small>
                  </article>
                );
              }) : (
                <article>
                  <span>{profile.email || 'Connected inbox'}</span>
                  <strong>Active</strong>
                  <small>Just now</small>
                  <small>18 sent today · Good</small>
                </article>
              )}
            </div>
            <div className="dashboard-profile-action-row">
              {connectedAccounts.length ? connectedAccounts.map((account) => (
                <div key={account.id || account.from} className="dashboard-profile-account-actions">
                  <button key={`${account.id || account.from}-manage`} type="button" className="ghost" onClick={() => setSelectedConnectedAccount(account)}>
                    Connect / Manage
                  </button>
                  <button type="button" className="ghost subtle" onClick={() => handleDisconnect(account)}>
                    Disconnect {account.from}
                  </button>
                </div>
              )) : null}
            </div>
          </article>

          <article id="settings" className={`dashboard-profile-card ${activeSection === 'settings' ? 'tone-settings' : ''}`}>
            <strong>Settings</strong>
            <p>Manage account preferences, theme, language, and workspace defaults.</p>
            <div className="dashboard-profile-action-row">
              <button type="button" className="ghost" onClick={() => setMessage('Theme and language controls are ready to wire up here.')}>
                Open Settings
              </button>
            </div>
          </article>

          <article id="notifications" className={`dashboard-profile-card ${activeSection === 'notifications' ? 'tone-notifications' : ''}`}>
            <strong>Notifications</strong>
            <p>Review alerts, campaign updates, and reply notifications in one place.</p>
            <div className="dashboard-profile-checklist">
              <label><input type="checkbox" checked={profileNotificationPrefs.campaignUpdates} onChange={() => toggleNotificationPref('campaignUpdates')} /> Campaign updates</label>
              <label><input type="checkbox" checked={profileNotificationPrefs.replyAlerts} onChange={() => toggleNotificationPref('replyAlerts')} /> Reply alerts</label>
              <label><input type="checkbox" checked={profileNotificationPrefs.weeklyReports} onChange={() => toggleNotificationPref('weeklyReports')} /> Weekly reports</label>
            </div>
            <div className="dashboard-profile-action-row">
              <button type="button" className="ghost subtle" onClick={() => setMessage('Notification preferences saved locally and synced to your profile.')}>
                View Notifications
              </button>
              <button type="button" className="ghost" onClick={() => setMessage('Notification preferences saved locally and synced to your profile.')}>
                Save Preferences
              </button>
            </div>
          </article>

          <article id="billing" className={`dashboard-profile-card ${activeSection === 'billing' ? 'tone-billing' : ''}`}>
            <strong>Billing</strong>
            <p>Plan details, usage credits, invoices, and upgrade options.</p>
            <div className="dashboard-profile-stats compact">
              <span><strong>{profile.planName || 'Basic'}</strong><small>Current Plan</small></span>
              <span><strong>{creditSummary.remainingCredits}</strong><small>Credits Left</small></span>
              <span><strong>7d</strong><small>Renewal</small></span>
            </div>
            <p className="dashboard-profile-note">Track plan usage, credits, and renewal timing before you upgrade.</p>
            <div className="dashboard-profile-upgrade-mini">
              <div>
                <span>Current</span>
                <strong>{profile.planName || 'Basic'}</strong>
              </div>
              <div>
                <span>Next Plan</span>
                <strong>{creditSummary.upgradeTargetPlan || (profile.planName === 'Basic' ? 'Pro' : 'Enterprise')}</strong>
              </div>
              <div>
                <span>Credits Left</span>
                <strong>{creditSummary.remainingCredits}</strong>
              </div>
            </div>
            <div className="dashboard-profile-meter">
              <div className="dashboard-profile-meter-track">
                <i style={{ width: `${Math.max(0, Math.min(100, creditSummary.creditUsagePercent))}%` }} />
              </div>
              <small>{Math.round(creditSummary.creditUsagePercent)}% of credits used this cycle</small>
            </div>
            {lowCreditWarning ? <p className="dashboard-profile-note dashboard-profile-warning"><span>Low balance</span> Upgrade before sends stop.</p> : null}
            <div className="dashboard-profile-chip-row dashboard-profile-billing-row">
              <span className="dashboard-profile-chip">Invoice ready</span>
              <span className="dashboard-profile-chip">Last payment: 07 Apr 2026</span>
            </div>
            <div className="dashboard-profile-action-row">
              <button type="button" className="ghost" onClick={handleOpenBilling}>Open Billing</button>
              <button type="button" className="ghost" onClick={handleDownloadInvoice}>
                Download Invoice
              </button>
            </div>
            <div className="dashboard-profile-action-row dashboard-profile-action-row-stack">
              <button type="button" className="ghost subtle dashboard-profile-upgrade-secondary" onClick={handleUpgradePlan}>
                {hasUpgrade ? `Upgrade to ${billingUpgradeTarget}` : 'Manage Plan'}
              </button>
            </div>
            <div className="dashboard-profile-note" style={{ marginTop: 18 }}>Credit history</div>
            <div className="dashboard-profile-transaction-list">
              {creditTransactions.length ? creditTransactions.map((item) => (
                <article key={item._id} className="dashboard-profile-transaction-item">
                  <div>
                    <strong>{item.reason || item.type}</strong>
                    <p>{item.campaignName || item.recipientEmail || 'Credit change'}</p>
                  </div>
                  <div>
                    <strong>{item.type === 'credit' ? '+' : '-'}{Math.abs(Number(item.credits || 0))}</strong>
                    <p>{formatDateTime(item.createdAt)}</p>
                  </div>
                </article>
              )) : <p className="dashboard-profile-note">No credit transactions yet.</p>}
            </div>
            <div className="dashboard-profile-action-row dashboard-profile-action-row-stack">
              <button type="button" className="ghost subtle" onClick={() => setShowCreditHistory(true)}>
                View all transactions
              </button>
            </div>
          </article>

          <article id="security" className={`dashboard-profile-card ${activeSection === 'security' ? 'tone-security' : ''}`}>
            <strong>Security</strong>
            <p>Password, sign-in activity, connected accounts, and account safety.</p>
            <div className="dashboard-profile-checklist">
              <label><input type="checkbox" defaultChecked /> Password protected</label>
              <label><input type="checkbox" defaultChecked /> Signed-in device active</label>
              <label><input type="checkbox" defaultChecked /> Logout on demand</label>
            </div>
            <div className="dashboard-profile-password">
              <input
                type="password"
                placeholder="Current password"
                value={profilePasswordForm.currentPassword}
                onChange={(event) => setProfilePasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              />
              <input
                type="password"
                placeholder="New password"
                value={profilePasswordForm.newPassword}
                onChange={(event) => setProfilePasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={profilePasswordForm.confirmPassword}
                onChange={(event) => setProfilePasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
            </div>
            <div className="dashboard-profile-action-row">
              <button type="button" className="ghost" onClick={handlePasswordChange}>
                Change Password
              </button>
              <button type="button" className="ghost subtle" onClick={() => setMessage('Security controls are ready for account safety settings.')}>
                Open Security
              </button>
            </div>
          </article>

          {message ? <p className="dashboard-profile-message">{message}</p> : null}
        </main>
        {selectedConnectedAccount && typeof window !== 'undefined'
          ? createPortal(
              <div className="dashboard-profile-modal-backdrop" onClick={() => setSelectedConnectedAccount(null)}>
                <div className="dashboard-profile-modal" onClick={(event) => event.stopPropagation()}>
              <div className="dashboard-profile-modal-head">
                <div>
                  <strong>{selectedConnectedAccount.from}</strong>
                  <p>Connect, manage, or disconnect this account.</p>
                </div>
                <button type="button" className="dashboard-profile-modal-close" onClick={() => setSelectedConnectedAccount(null)}>
                  × Close
                </button>
              </div>
              <div className="dashboard-profile-chip-row dashboard-profile-modal-meta">
                <span className="dashboard-profile-chip">{accountSummary(selectedConnectedAccount).provider}</span>
                <span className="dashboard-profile-chip">{accountSummary(selectedConnectedAccount).status}</span>
                <span className="dashboard-profile-chip">{accountSummary(selectedConnectedAccount).type}</span>
              </div>
              <div className="dashboard-profile-modal-summary">
                <article>
                  <span>Mail ID</span>
                  <strong>{selectedConnectedAccount.from}</strong>
                </article>
                <article>
                  <span>Provider</span>
                  <strong>{accountSummary(selectedConnectedAccount).provider}</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong>{accountSummary(selectedConnectedAccount).status}</strong>
                </article>
                <article>
                  <span>Last Sync</span>
                  <strong>{accountSummary(selectedConnectedAccount).lastSync}</strong>
                </article>
              </div>
              <div className="dashboard-profile-modal-summary dashboard-profile-modal-summary-soft">
                <article>
                  <span>Daily Send Limit</span>
                  <strong>{accountSummary(selectedConnectedAccount).dailyLimit}</strong>
                </article>
                <article>
                  <span>Sent Today</span>
                  <strong>{accountSummary(selectedConnectedAccount).sentToday}</strong>
                </article>
                <article>
                  <span>Errors</span>
                  <strong>{accountSummary(selectedConnectedAccount).errors}</strong>
                </article>
                <article>
                  <span>Sync Health</span>
                  <strong>{accountSummary(selectedConnectedAccount).health}</strong>
                </article>
              </div>
              <div className="dashboard-profile-modal-actions">
                <button type="button" className="ghost" onClick={() => setMessage(`Manage ${selectedConnectedAccount.from} from the connected accounts list.`)}>
                  Open Account
                </button>
                <button type="button" className="ghost subtle" onClick={() => {
                  handleDisconnect(selectedConnectedAccount);
                  setSelectedConnectedAccount(null);
                }}>
                  Disconnect
                </button>
              </div>
                </div>
              </div>,
              document.body
            )
          : null}
        {showCreditHistory && typeof window !== 'undefined'
          ? createPortal(
              <div className="dashboard-profile-modal-backdrop" onClick={() => setShowCreditHistory(false)}>
                <div className="dashboard-profile-modal dashboard-profile-credit-history-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="dashboard-profile-modal-head">
                    <div>
                      <strong>Credit transactions</strong>
                      <p>Review credit debits, refunds, and balance changes.</p>
                    </div>
                    <button type="button" className="dashboard-profile-modal-close" onClick={() => setShowCreditHistory(false)}>
                      × Close
                    </button>
                  </div>
                  <div className="dashboard-profile-credit-history-head">
                    <span>Reason</span>
                    <span>Amount</span>
                    <span>Balance after</span>
                    <span>Date</span>
                  </div>
                  <div className="dashboard-profile-credit-history-list">
                    {creditTransactions.length ? creditTransactions.map((item) => (
                      <article key={item._id} className="dashboard-profile-credit-history-row">
                        <strong>{item.reason || item.type}</strong>
                        <span className={item.type === 'credit' ? 'credit-positive' : 'credit-negative'}>
                          {item.type === 'credit' ? '+' : '-'}{Math.abs(Number(item.credits || 0))}
                        </span>
                        <span>{Math.max(0, Number(item.balanceAfter || 0))}</span>
                        <small>{formatDateTime(item.createdAt)}</small>
                      </article>
                    )) : <p className="dashboard-profile-note">No credit transactions yet.</p>}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
      </section>
    </AppLayout>
  );
}
