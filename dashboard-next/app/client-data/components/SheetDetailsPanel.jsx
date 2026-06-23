'use client';

import { useMemo, useState } from 'react';

// Format helper
function formatTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SheetDetailsPanel({
  lists = [],
  activeSourceSheetId = '',
  onSelectSheet,
  campaigns = []
}) {
  const [showPanel, setShowPanel] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('details'); // 'details' | 'campaigns' | 'history'

  const activeSheet = useMemo(() => {
    if (!activeSourceSheetId) return null;
    return lists.find((l) => String(l._id || l.id) === String(activeSourceSheetId)) || null;
  }, [lists, activeSourceSheetId]);

  // Campaigns that have used the active sheet
  const sheetCampaigns = useMemo(() => {
    if (!activeSourceSheetId) return [];
    return campaigns.filter((camp) => String(camp.listId) === String(activeSourceSheetId));
  }, [campaigns, activeSourceSheetId]);

  if (!showPanel) {
    return (
      <div style={{ margin: '10px 0' }}>
        <button
          type="button"
          className="client-data-section-switcher-button active"
          onClick={() => setShowPanel(true)}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            borderRadius: '6px',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className="ti ti-info-circle" aria-hidden="true" /> Show Sheet Info & History
        </button>
      </div>
    );
  }

  return (
    <div
      className="sheet-details-panel-card"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '10px',
          marginBottom: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
            {activeSheet ? `Sheet: ${activeSheet.name}` : 'All Sheets Audit & History'}
          </h3>
          {/* Sub-navigation tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeSheet && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('details')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: activeSubTab === 'details' ? '#e0f2fe' : 'transparent',
                    color: activeSubTab === 'details' ? '#0369a1' : '#475569',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Sheet Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('campaigns')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: activeSubTab === 'campaigns' ? '#e0f2fe' : 'transparent',
                    color: activeSubTab === 'campaigns' ? '#0369a1' : '#475569',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Campaigns ({sheetCampaigns.length})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setActiveSubTab('history')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '4px',
                background: activeSubTab === 'history' ? '#e0f2fe' : 'transparent',
                color: activeSubTab === 'history' ? '#0369a1' : '#475569',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              All Sheets Directory
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPanel(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          ✕ Hide Info
        </button>
      </div>

      {/* Sheet Details Tab */}
      {activeSubTab === 'details' && activeSheet && (
        <div className="sheet-details-content-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Sheet ID</span>
            <strong style={{ fontSize: '12px', color: '#1e293b', wordBreak: 'break-all' }}>{activeSheet._id}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Custom Sheet Name</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{activeSheet.name}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Original Source File</span>
            <strong style={{ fontSize: '12px', color: '#1e293b', wordBreak: 'break-all' }}>{activeSheet.sourceFile || '-'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Upload Date</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{formatDate(activeSheet.uploadedAt)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Upload Time</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{formatTime(activeSheet.uploadedAt)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Created By User</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{activeSheet.createdBy || activeSheet.userEmail || 'System'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Project Name</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{activeSheet.project || activeSheet.projectName || 'Unassigned'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Sender ID</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{activeSheet.metadata?.senderId || '-'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Source Type</span>
            <strong style={{ fontSize: '12px', color: '#1e293b', textTransform: 'capitalize' }}>
              {activeSheet.metadata?.sourceType || activeSheet.kind}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Total Records</span>
            <strong style={{ fontSize: '12px', color: '#1e293b' }}>{activeSheet.metadata?.totalClients ?? activeSheet.leadCount}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Valid Records</span>
            <strong style={{ fontSize: '12px', color: '#16a34a' }}>{activeSheet.metadata?.validClients ?? activeSheet.leadCount}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Invalid Records</span>
            <strong style={{ fontSize: '12px', color: '#dc2626' }}>{activeSheet.metadata?.invalidClients ?? 0}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Duplicate Records</span>
            <strong style={{ fontSize: '12px', color: '#ea580c' }}>{activeSheet.metadata?.repeatedClients ?? 0}</strong>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 600 }}>Latest Campaign Used</span>
            <strong style={{ fontSize: '12px', color: '#0284c7' }}>{activeSheet.metadata?.campaignName || '-'}</strong>
          </div>
        </div>
      )}

      {/* Campaigns Relationship Tab */}
      {activeSubTab === 'campaigns' && activeSheet && (
        <div style={{ overflowX: 'auto' }}>
          {sheetCampaigns.length === 0 ? (
            <p style={{ margin: 0, padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
              This sheet is not yet linked to any campaign.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Campaign Name</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Campaign ID</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Project</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Sender ID</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Draft / Type</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Date & Time Used</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Total Recipients</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Sent</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {sheetCampaigns.map((camp) => (
                  <tr key={camp._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{camp.name}</td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{camp._id}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>{camp.project || '-'}</td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{camp.senderFrom || '-'}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{camp.type || camp.draftType || '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {formatDate(camp.createdAt)} {formatTime(camp.createdAt)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{camp.totalRecipients || camp.stats?.total || 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{camp.sentCount || camp.stats?.sent || 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{camp.pendingCount || camp.stats?.pending || 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{camp.failedCount || camp.stats?.failed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sheets Directory / Sheet History Panel */}
      {activeSubTab === 'history' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Sheet ID</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Sheet Name</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Project</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Upload Date</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Upload Time</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Sender ID</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Total Clients</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Valid</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Invalid</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>Duplicate</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Last Campaign</th>
                <th style={{ padding: '8px 12px', fontWeight: 700, color: '#334155' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => {
                const isSelected = String(list._id || list.id) === String(activeSourceSheetId);
                return (
                  <tr
                    key={list._id || list.id}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: isSelected ? '#f0f9ff' : 'transparent',
                      fontWeight: isSelected ? '600' : 'normal'
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{list._id || list.id}</td>
                    <td style={{ padding: '8px 12px', color: '#0f172a' }}>{list.name}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'uppercase' }}>{list.project || list.projectName || '-'}</td>
                    <td style={{ padding: '8px 12px' }}>{formatDate(list.uploadedAt)}</td>
                    <td style={{ padding: '8px 12px' }}>{formatTime(list.uploadedAt)}</td>
                    <td style={{ padding: '8px 12px' }}>{list.metadata?.senderId || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{list.metadata?.totalClients ?? list.leadCount}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#16a34a' }}>{list.metadata?.validClients ?? list.leadCount}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#dc2626' }}>{list.metadata?.invalidClients ?? 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ea580c' }}>{list.metadata?.repeatedClients ?? 0}</td>
                    <td style={{ padding: '8px 12px', color: '#0284c7' }}>{list.metadata?.campaignName || '-'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSheet(list._id || list.id);
                          setActiveSubTab('details');
                        }}
                        style={{
                          padding: '2px 8px',
                          background: 'var(--accent, #2563eb)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
