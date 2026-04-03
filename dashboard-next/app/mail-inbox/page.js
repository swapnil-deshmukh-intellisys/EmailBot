'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import PageContainer from '@/app/components/layout/PageContainer';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';

const badgeToneMap = {
  Received: 'info',
  Sending: 'success',
  Draft: 'warning',
  Junk: 'danger',
  Spam: 'danger',
  Deleted: 'default'
};

const FILTER_ORDER = ['All', 'Received', 'Sending', 'Draft', 'Spam', 'Deleted'];

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function normalizeFolderLabel(label) {
  const value = String(label || '').trim();
  if (value.toLowerCase() === 'junk') return 'Spam';
  return value;
}

export default function MailInboxPage() {
  const [mailboxData, setMailboxData] = useState({ connected: false, account: null, folders: [], messages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadMailbox = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/mailbox-folders', { cache: 'no-store' });
        const data = await response.json();

        if (!active) return;

        setMailboxData({
          connected: Boolean(data?.connected),
          account: data?.account || null,
          folders: Array.isArray(data?.folders) ? data.folders : [],
          messages: Array.isArray(data?.messages) ? data.messages : []
        });

        setError(data?.error || '');

        if (!response.ok && !data?.messages?.length) {
          setError(data?.error || 'Failed to load mailbox data');
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load mailbox data');
        if (!silent) {
          setMailboxData({ connected: false, account: null, folders: [], messages: [] });
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadMailbox({ silent: true });
      }
    };

    void loadMailbox();
    intervalId = window.setInterval(() => {
      void loadMailbox({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const folderCountMap = useMemo(() => {
    const map = new Map();
    for (const folder of mailboxData.folders) {
      map.set(folder.label, Number(folder.count || 0));
      if (String(folder.label).toLowerCase() === 'junk') {
        map.set('Spam', Number(folder.count || 0));
      }
    }
    return map;
  }, [mailboxData.folders]);

  const filterCards = useMemo(
    () => FILTER_ORDER.map((label) => ({
      label,
      count: label === 'All'
        ? mailboxData.messages.length
        : Number(folderCountMap.get(label) || 0)
    })),
    [folderCountMap, mailboxData.messages.length]
  );

  const filteredMessages = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();
    return mailboxData.messages.filter((message) => {
      const folder = normalizeFolderLabel(message.folderLabel);
      const matchesFilter = selectedFilter === 'All' || folder === selectedFilter;
      const haystack = [
        message.subject,
        message.from,
        ...(Array.isArray(message.to) ? message.to : [])
      ].join(' ').toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [mailboxData.messages, searchTerm, selectedFilter]);

  useEffect(() => {
    const currentExists = filteredMessages.some((item) => item.id === selectedMessageId);
    if (!currentExists) {
      setSelectedMessageId(filteredMessages[0]?.id || '');
    }
  }, [filteredMessages, selectedMessageId]);

  const selectedMessage = useMemo(
    () => filteredMessages.find((item) => item.id === selectedMessageId) || filteredMessages[0] || null,
    [filteredMessages, selectedMessageId]
  );

  const inboxItems = useMemo(
    () => [
      { title: 'Received', meta: `${folderCountMap.get('Received') || 0} inbox mails found` },
      { title: 'Sending', meta: `${folderCountMap.get('Sending') || 0} sent mails found` },
      { title: 'Draft', meta: `${folderCountMap.get('Draft') || 0} draft mails found` },
      { title: 'Junk / Spam', meta: `${folderCountMap.get('Junk') || folderCountMap.get('Spam') || 0} junk or spam mails found` },
      { title: 'Deleted', meta: `${folderCountMap.get('Deleted') || 0} deleted mails found` }
    ],
    [folderCountMap]
  );

  const activityItems = useMemo(
    () =>
      mailboxData.messages.slice(0, 3).map((item) => ({
        title: item.subject || '(No subject)',
        meta: `${normalizeFolderLabel(item.folderLabel)} | ${formatDateTime(item.receivedAt || item.updatedAt)}`
      })),
    [mailboxData.messages]
  );

  return (
    <AppLayout
      topbarProps={{
        title: 'Mail Inbox',
        subtitle: 'See received, sending, junk, spam, deleted, and draft mails from your connected mailbox.',
        actions: (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = '/api/graph-oauth/start?returnTo=/mail-inbox';
              }}
            >
              Connect Mailbox
            </Button>
            <Button onClick={() => window.location.reload()}>
              Refresh Mail
            </Button>
          </>
        )
      }}
    >
      <PageContainer>
        <PageSection
          title="Mailbox Pulse"
          description="Mailbox folders are loaded live from your connected Microsoft account."
        >
          <div className="mail-inbox-hero">
            <div className="mail-inbox-account-card">
              <span className="mail-inbox-account-kicker">Connected Mailbox</span>
              <strong>{mailboxData.account?.displayName || mailboxData.account?.email || 'Microsoft mailbox not connected'}</strong>
              <p>
                {mailboxData.connected
                  ? `Live folders synced for ${mailboxData.account?.email || 'your mailbox'}`
                  : 'Connect a Microsoft mailbox to load received, sent, junk, spam, draft, and deleted mails.'}
              </p>
            </div>
            <div className="mail-inbox-stat-grid">
              {[
                { label: 'Received', value: loading ? '...' : String(folderCountMap.get('Received') || 0) },
                { label: 'Sending', value: loading ? '...' : String(folderCountMap.get('Sending') || 0) },
                { label: 'Draft', value: loading ? '...' : String(folderCountMap.get('Draft') || 0) },
                { label: 'Junk / Spam', value: loading ? '...' : String(folderCountMap.get('Junk') || folderCountMap.get('Spam') || 0) },
                { label: 'Deleted', value: loading ? '...' : String(folderCountMap.get('Deleted') || 0) }
              ].map((card) => (
                <div key={card.label} className="mail-inbox-stat-tile">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </PageSection>

        <PageSection
          title="Mail Workspace"
          description="A cleaner mailbox layout for scanning folders, message lists, and recent activity."
        >
          <div className="mail-inbox-layout">
            <Card className="client-data-panel mail-inbox-sidebar">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Folders</CardTitle>
                  <CardDescription>Filter the live mailbox feed.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mail-inbox-folder-list">
                  {filterCards.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={`mail-inbox-folder-item ${selectedFilter === item.label ? 'active' : ''}`}
                      onClick={() => setSelectedFilter(item.label)}
                    >
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel mail-inbox-feed">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Inbox Feed</CardTitle>
                  <CardDescription>Real mailbox messages from Inbox, Sent, Drafts, Junk, and Deleted folders.</CardDescription>
                </div>
                <div className="mail-inbox-head-tools">
                  <input
                    className="input"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search subject, sender, or recipient"
                  />
                  <Button variant="ghost" size="sm">
                    {loading ? '...' : `${filteredMessages.length} mails`}
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="mail-inbox-message-list">
                  {loading ? (
                    <div className="mail-inbox-empty-state">Loading mailbox messages...</div>
                  ) : null}

                  {!loading && error && !filteredMessages.length ? (
                    <div className="mail-inbox-empty-state">{error}</div>
                  ) : null}

                  {!loading && !error && !filteredMessages.length ? (
                    <div className="mail-inbox-empty-state">No mails found for this folder/filter.</div>
                  ) : null}

                  {!loading && filteredMessages.map((row) => {
                    const folder = normalizeFolderLabel(row.folderLabel);
                    const isActive = selectedMessage?.id === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={`mail-inbox-message-card ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedMessageId(row.id)}
                      >
                        <div className="mail-inbox-message-top">
                          <strong>{row.subject}</strong>
                          <Badge variant={badgeToneMap[folder] || 'default'}>
                            {folder}
                          </Badge>
                        </div>
                        <div className="mail-inbox-message-meta">
                          <span>{row.from || 'Unknown sender'}</span>
                          <span>{formatDateTime(row.receivedAt || row.updatedAt)}</span>
                        </div>
                        <p>{(row.to && row.to.join(', ')) || mailboxData.account?.email || '-'}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel mail-inbox-preview">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Message Details</CardTitle>
                  <CardDescription>Selected mail context and folder status.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {selectedMessage ? (
                  <div className="mail-inbox-preview-card">
                    <div className="mail-inbox-preview-badges">
                      <Badge variant={badgeToneMap[normalizeFolderLabel(selectedMessage.folderLabel)] || 'default'}>
                        {normalizeFolderLabel(selectedMessage.folderLabel)}
                      </Badge>
                    </div>
                    <h3>{selectedMessage.subject}</h3>
                    <div className="mail-inbox-preview-meta">
                      <div>
                        <span>From</span>
                        <strong>{selectedMessage.from || '-'}</strong>
                      </div>
                      <div>
                        <span>To</span>
                        <strong>{(selectedMessage.to && selectedMessage.to.join(', ')) || mailboxData.account?.email || '-'}</strong>
                      </div>
                      <div>
                        <span>Updated</span>
                        <strong>{formatDateTime(selectedMessage.receivedAt || selectedMessage.updatedAt)}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mail-inbox-empty-state">
                    Select a mail item to see its details.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </PageSection>

        <PageSection
          title="Mailbox Notes"
          description="Operational summaries and latest activity from the connected account."
        >
          <div className="client-data-grid">
            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Mailbox Buckets</CardTitle>
                  <CardDescription>Folder counts from your connected mailbox.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-health-list">
                  {inboxItems.map((item) => (
                    <div key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Mail Activity</CardTitle>
                  <CardDescription>Latest mailbox activity from the connected account.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-activity-list">
                  {activityItems.length ? activityItems.map((item) => (
                    <article key={`${item.title}-${item.meta}`}>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </article>
                  )) : (
                    <article>
                      <strong>No mailbox activity</strong>
                      <p>Connect the mailbox again if Graph mailbox permissions were not granted earlier.</p>
                    </article>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </PageSection>
      </PageContainer>
    </AppLayout>
  );
}
