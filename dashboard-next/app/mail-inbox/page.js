'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import Badge from '@/app/components/ui/Badge';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'flagged', label: 'Flagged' }
];

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatMailTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getMessageDate(message = {}) {
  return message.receivedDateTime || message.sentDateTime || message.createdDateTime || message.lastModifiedDateTime;
}

function getFromLabel(message = {}, fallback = '') {
  return message.from?.name || message.from?.email || message.sender?.name || message.sender?.email || fallback || 'Unknown sender';
}

function getApiMessage(data, fallback) {
  return data?.message || data?.error || data?.code || fallback;
}

function getFolderIcon(folder = {}) {
  const name = String(folder.displayName || folder.wellKnownName || '').toLowerCase();
  if (name.includes('inbox')) return 'IN';
  if (name.includes('sent')) return 'SE';
  if (name.includes('draft')) return 'DR';
  if (name.includes('deleted') || name.includes('trash')) return 'DE';
  if (name.includes('junk') || name.includes('spam')) return 'JU';
  if (name.includes('archive')) return 'AR';
  return 'FL';
}

function MailSkeleton({ rows = 5 }) {
  return (
    <div className="master-mail-skeleton-list">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={`mail-skeleton-${index}`} className="master-mail-skeleton-row" />
      ))}
    </div>
  );
}

export default function MailInboxPage() {
  const [account, setAccount] = useState(null);
  const [connected, setConnected] = useState(false);
  const [folders, setFolders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [folderLoading, setFolderLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showFoldersMobile, setShowFoldersMobile] = useState(false);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState({ to: '', subject: '', body: '' });

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const loadFolders = useCallback(async () => {
    try {
      setFolderLoading(true);
      setError('');
      const accountResponse = await fetch('/api/mailbox/accounts', { cache: 'no-store' });
      const accountData = await accountResponse.json().catch(() => ({}));
      if (!accountResponse.ok || accountData?.success === false) {
        throw new Error(getApiMessage(accountData, 'Mailbox not connected'));
      }
      setConnected(Boolean(accountData.connected));
      setAccount(accountData.account || null);
      if (!accountData.connected) {
        setFolders([]);
        setMessages([]);
        setSelectedFolderId('');
        setSelectedMessageId('');
        setSelectedMessage(null);
        setError('');
        return;
      }

      const folderResponse = await fetch('/api/mailbox/folders', { cache: 'no-store' });
      const folderData = await folderResponse.json().catch(() => ({}));
      if (!folderResponse.ok || folderData?.success === false) {
        throw new Error(getApiMessage(folderData, 'Unable to fetch mailbox folders'));
      }

      const nextFolders = Array.isArray(folderData.folders) ? folderData.folders : [];
      setFolders(nextFolders);
      const inbox = nextFolders.find((folder) => String(folder.displayName || folder.wellKnownName || '').toLowerCase().includes('inbox'));
      const nextSelected = selectedFolderId && nextFolders.some((folder) => folder.id === selectedFolderId)
        ? selectedFolderId
        : inbox?.id || nextFolders[0]?.id || '';
      setSelectedFolderId(nextSelected);
    } catch (err) {
      setError(err.message || 'Unable to fetch mailbox folders');
      setConnected(false);
      setAccount(null);
      setFolders([]);
    } finally {
      setFolderLoading(false);
    }
  }, [selectedFolderId]);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!selectedFolderId) return;
    try {
      if (silent) setRefreshing(true);
      if (!silent) setMessageLoading(true);
      setError('');
      const params = new URLSearchParams({ folder: selectedFolderId, top: '30' });
      if (filter === 'unread') params.set('unread', 'true');
      if (filter === 'flagged') params.set('flagged', 'true');
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const response = await fetch(`/api/mailbox/messages?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(getApiMessage(data, 'Unable to fetch inbox messages'));
      }
      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);
      setSelectedMessageId((current) => (
        current && nextMessages.some((message) => message.id === current)
          ? current
          : nextMessages[0]?.id || ''
      ));
    } catch (err) {
      setError(err.message || 'Unable to fetch inbox messages');
      if (!silent) setMessages([]);
    } finally {
      setMessageLoading(false);
      setRefreshing(false);
    }
  }, [filter, searchTerm, selectedFolderId]);

  const loadMessageDetail = useCallback(async (messageId) => {
    if (!messageId) {
      setSelectedMessage(null);
      return;
    }
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/mailbox/messages/${encodeURIComponent(messageId)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(getApiMessage(data, 'Unable to fetch email details'));
      }
      setSelectedMessage(data.message || null);
      setShowDetailMobile(true);
    } catch (err) {
      setError(err.message || 'Unable to fetch email details');
      setSelectedMessage(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    void loadMessageDetail(selectedMessageId);
  }, [loadMessageDetail, selectedMessageId]);

  const handleRefresh = useCallback(async () => {
    setNotice('');
    await loadFolders();
    await loadMessages({ silent: true });
  }, [loadFolders, loadMessages]);

  const handleMessageAction = useCallback(async (action, messageId = selectedMessageId, extraBody = {}) => {
    if (!messageId) return;
    const endpointMap = {
      archive: `/api/mailbox/messages/${encodeURIComponent(messageId)}/archive`,
      delete: `/api/mailbox/messages/${encodeURIComponent(messageId)}/delete`,
      read: `/api/mailbox/messages/${encodeURIComponent(messageId)}/mark-read`,
      unread: `/api/mailbox/messages/${encodeURIComponent(messageId)}/mark-read`
    };
    try {
      setActionLoading(action);
      setNotice('');
      const response = await fetch(endpointMap[action], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'unread' ? { isRead: false } : extraBody)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(getApiMessage(data, 'Mailbox action failed'));
      }
      setNotice(data.message || 'Mailbox updated');
      await loadMessages({ silent: true });
    } catch (err) {
      setError(err.message || 'Mailbox action failed');
    } finally {
      setActionLoading('');
    }
  }, [loadMessages, selectedMessageId]);

  const handleSend = useCallback(async () => {
    try {
      setActionLoading('send');
      setNotice('');
      const response = await fetch('/api/mailbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeDraft)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.success === false) {
        throw new Error(getApiMessage(data, 'Unable to send email'));
      }
      setNotice('Email sent');
      setComposerOpen(false);
      setComposeDraft({ to: '', subject: '', body: '' });
    } catch (err) {
      setError(err.message || 'Unable to send email');
    } finally {
      setActionLoading('');
    }
  }, [composeDraft]);

  const openConnect = () => {
    window.location.href = '/api/graph-oauth/start?returnTo=/mail-inbox';
  };

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      <main className="master-mail-page">
        <section className="master-mail-shell">
          <aside className={`master-mail-sidebar ${showFoldersMobile ? 'is-open' : ''}`}>
            <div className="master-mail-account">
              <span>Connected Mailbox</span>
              <strong>{account?.email || 'No Outlook mailbox'}</strong>
              <small>{connected ? account?.displayName || 'Microsoft Outlook' : 'Connect Outlook to load mail'}</small>
            </div>

            <div className="master-mail-sidebar-actions">
              <Button type="button" onClick={() => connected ? setComposerOpen(true) : openConnect()}>
                {connected ? 'Compose' : 'Connect Outlook Mailbox'}
              </Button>
              <Button type="button" variant="ghost" loading={refreshing || folderLoading} onClick={handleRefresh} disabled={!connected}>
                Refresh
              </Button>
            </div>

            <div className="master-mail-folder-title">Folders</div>
            <div className="master-mail-folder-list">
              {folderLoading ? <MailSkeleton rows={7} /> : null}
              {!folderLoading && folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`master-mail-folder ${selectedFolderId === folder.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFolderId(folder.id);
                    setShowFoldersMobile(false);
                  }}
                >
                  <span className="master-mail-folder-icon">{getFolderIcon(folder)}</span>
                  <span className="master-mail-folder-name">{folder.displayName}</span>
                  {folder.unreadItemCount > 0 ? <strong>{folder.unreadItemCount}</strong> : null}
                </button>
              ))}
              {!folderLoading && connected && !folders.length ? (
                <div className="master-mail-empty-small">No Outlook folders returned by Microsoft Graph.</div>
              ) : null}
            </div>
          </aside>

          <section className="master-mail-list-pane">
            <div className="master-mail-mobile-bar">
              <Button type="button" variant="secondary" onClick={() => setShowFoldersMobile(true)}>Folders</Button>
              <Button type="button" variant="ghost" loading={refreshing} onClick={handleRefresh}>Refresh</Button>
            </div>

            <div className="master-mail-list-header">
              <div>
                <span>{selectedFolder?.displayName || 'Master Inbox'}</span>
                <h1>Master Inbox</h1>
              </div>
              <Badge variant={connected ? 'success' : 'warning'}>
                {connected ? account?.email || 'Connected' : 'Mailbox not connected'}
              </Badge>
            </div>

            <div className="master-mail-search-row">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadMessages();
                }}
                placeholder="Search mail"
              />
              <Button type="button" variant="secondary" loading={messageLoading} onClick={() => loadMessages()}>
                Search
              </Button>
            </div>

            <div className="master-mail-filter-tabs">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={filter === item.key ? 'active' : ''}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="master-mail-alert error">
                <span>{error}</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleRefresh}>Retry</Button>
              </div>
            ) : null}
            {notice ? <div className="master-mail-alert success">{notice}</div> : null}

            {!connected && !folderLoading ? (
              <div className="master-mail-connect-state">
                <strong>Mailbox not connected</strong>
                <p>Connect Outlook Mailbox to show only your Microsoft mailbox folders and messages.</p>
                <Button type="button" onClick={openConnect}>Connect Outlook Mailbox</Button>
              </div>
            ) : null}

            {connected ? (
              <div className="master-mail-message-list">
                {messageLoading ? <MailSkeleton rows={8} /> : null}
                {!messageLoading && !messages.length ? (
                  <div className="master-mail-connect-state">
                    <strong>Empty folder</strong>
                    <p>No messages found in this folder or filter.</p>
                  </div>
                ) : null}
                {!messageLoading && messages.map((message) => {
                  const active = selectedMessageId === message.id;
                  const unread = !message.isRead;
                  return (
                    <button
                      key={message.id}
                      type="button"
                      className={`master-mail-row ${active ? 'active' : ''} ${unread ? 'unread' : ''}`}
                      onClick={() => setSelectedMessageId(message.id)}
                    >
                      <div className="master-mail-row-top">
                        <strong>{getFromLabel(message, account?.email)}</strong>
                        <span>{formatMailTime(getMessageDate(message))}</span>
                      </div>
                      <div className="master-mail-row-subject">
                        <span>{message.subject}</span>
                        {message.hasAttachments ? <em aria-label="Has attachments">A</em> : null}
                      </div>
                      <p>{message.preview || 'No preview available.'}</p>
                      <div className="master-mail-row-meta">
                        {message.importance === 'high' ? <Badge variant="danger" size="sm">Important</Badge> : null}
                        {message.flag?.flagStatus === 'flagged' ? <Badge variant="warning" size="sm">Flagged</Badge> : null}
                        {message.isDraft ? <Badge variant="warning" size="sm">Draft</Badge> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className={`master-mail-reading-pane ${showDetailMobile ? 'is-open' : ''}`}>
            <div className="master-mail-reading-head">
              <button type="button" className="master-mail-mobile-close" onClick={() => setShowDetailMobile(false)}>Back</button>
              <div>
                <span>Reading Pane</span>
                <h2>{selectedMessage?.subject || 'Select an email'}</h2>
              </div>
            </div>

            {detailLoading ? <MailSkeleton rows={5} /> : null}

            {!detailLoading && selectedMessage ? (
              <>
                <div className="master-mail-reading-actions">
                  <Button type="button" variant="secondary" loading={actionLoading === 'unread'} onClick={() => handleMessageAction('unread')}>
                    Mark unread
                  </Button>
                  <Button type="button" variant="secondary" loading={actionLoading === 'archive'} onClick={() => handleMessageAction('archive')}>
                    Archive
                  </Button>
                  <Button type="button" variant="danger" loading={actionLoading === 'delete'} onClick={() => handleMessageAction('delete')}>
                    Delete
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setComposeDraft({
                    to: selectedMessage.from?.email || '',
                    subject: `RE: ${selectedMessage.subject || ''}`,
                    body: ''
                  }) || setComposerOpen(true)}>
                    Reply
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setComposeDraft({
                    to: '',
                    subject: `FW: ${selectedMessage.subject || ''}`,
                    body: ''
                  }) || setComposerOpen(true)}>
                    Forward
                  </Button>
                </div>

                <div className="master-mail-reading-meta">
                  <div><span>From</span><strong>{selectedMessage.from?.name || selectedMessage.from?.email || '-'}</strong></div>
                  <div><span>To</span><strong>{selectedMessage.to?.map((item) => item.address || item.email).filter(Boolean).join(', ') || '-'}</strong></div>
                  <div><span>Date</span><strong>{formatDateTime(getMessageDate(selectedMessage))}</strong></div>
                  <div><span>Importance</span><strong>{selectedMessage.importance || 'normal'}</strong></div>
                </div>

                {selectedMessage.attachments?.length ? (
                  <div className="master-mail-attachments">
                    {selectedMessage.attachments.map((item) => (
                      <span key={item.id}>{item.name} ({Math.ceil(Number(item.size || 0) / 1024)} KB)</span>
                    ))}
                  </div>
                ) : null}

                <iframe
                  className="master-mail-body-frame"
                  title="Email body"
                  sandbox=""
                  srcDoc={selectedMessage.body?.content || '<p>No email body available.</p>'}
                />
              </>
            ) : null}

            {!detailLoading && !selectedMessage ? (
              <div className="master-mail-connect-state">
                <strong>No email selected</strong>
                <p>Select a message from the list to read it here.</p>
              </div>
            ) : null}
          </section>
        </section>

        {composerOpen ? (
          <div className="master-mail-compose-backdrop" onClick={() => setComposerOpen(false)}>
            <section className="master-mail-compose" onClick={(event) => event.stopPropagation()}>
              <div className="master-mail-compose-head">
                <strong>New message</strong>
                <button type="button" onClick={() => setComposerOpen(false)}>x</button>
              </div>
              <input value={composeDraft.to} onChange={(event) => setComposeDraft((draft) => ({ ...draft, to: event.target.value }))} placeholder="To" />
              <input value={composeDraft.subject} onChange={(event) => setComposeDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="Subject" />
              <textarea value={composeDraft.body} onChange={(event) => setComposeDraft((draft) => ({ ...draft, body: event.target.value }))} placeholder="Write your message" rows={8} />
              <div className="master-mail-compose-actions">
                <Button type="button" loading={actionLoading === 'send'} onClick={handleSend}>Send</Button>
                <Button type="button" variant="ghost" onClick={() => setComposerOpen(false)}>Cancel</Button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </AppLayout>
  );
}
