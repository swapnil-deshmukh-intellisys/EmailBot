import React from 'react';
import SalesActionCenter from './SalesActionCenter';

/**
 * NotificationItem renders an individual inbox item in the Inbox panel.
 */
function NotificationItem({ item, onClick }) {
  const content = (
    <>
      <div className="inbox-dot"></div>
      <div className="inbox-avatar">{item.avatar || 'SS'}</div>
      <div className="inbox-text">
        <div className="inbox-sender">{item.title || item.name}</div>
        <div className="inbox-preview">{item.preview || item.text || item.subject}</div>
      </div>
      <div className="inbox-time">{item.time}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="inbox-item" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="inbox-item">{content}</div>;
}

/**
 * MainPanels component renders the middle sections of the dashboard:
 * - Daily Work Report panel
 * - Calendar panel
 * - Inbox panel
 * - Write Note panel
 * - Broadcast Performance table
 */
export default function MainPanels({
  // Legacy target analytics props remain accepted for reporting flows outside this card.
  targetMode,
  setTargetMode,
  customTargetStart,
  setCustomTargetStart,
  customTargetEnd,
  setCustomTargetEnd,
  targetLimit,
  targetSentCount,
  targetRemaining,
  targetPercent,
  targetWindowLabel,
  targetAchieved,
  targetResetText,
  targetStatusTone,
  targetApprovalLabel,
  targetApprovalReviewedAt,
  targetApprovalRequestNote,
  targetPeriodValue,
  targetDailyCount,
  setTargetApprovalStatusState,
  onShowMessage,

  // Calendar Panel Props
  monthLabel,
  setCalendarCursor,
  calendarViewMode,
  weekdayLabels,
  calendarCells,
  allCalendarEvents,
  sameDay,
  getCalendarEventTone,
  selectedDate,
  setSelectedDate,
  openAnchoredPopup,
  setShowDayPopup,
  setShowCalendarPopup,
  calendarLoading,
  selectedEvents,
  openEventForm,
  todayCalendarEvents,
  upcomingTaskCount,
  upcomingCampaignCount,
  upcomingMeetingCount,
  upcomingCalendarEvents,
  today,

  // Inbox Panel Props
  setShowNotificationsPopup,
  notificationCards,
  openInboxMail,

  // Write Note Panel Props
  noteTopic,
  setNoteTopic,
  noteTag,
  setNoteTag,
  noteDraft,
  setNoteDraft,
  setShowNotesPopup,
  addQuickNote,

  // Broadcast Table Props
  broadcastPerformanceRef,
  onRefreshCampaigns,
  campaignRefreshing,
  selectedRows,
  handleSelectionSummaryClick,
  tagFilterRef,
  openTagFilterMenu,
  showTagFilterMenu,
  selectedTagFilterLabel,
  tableSearch,
  setTableSearch,
  handleActionCenterClick,
  paginatedCampaigns,
  openActionMenu,
  setOpenActionMenu,
  resumeCampaignDraft,
  handleViewCampaign,
  toggleRowSelection,
  actionMenuRef,
  handleEditTagsClick,
  onPauseCampaign,
  onStopCampaign,
  onResumeCampaign,
  handleDeleteCampaignClick,
  toggleAllRows,
  currentTablePage,
  setCurrentTablePage,
  totalTablePages
}) {
  const referenceInboxItems = notificationCards.length
    ? notificationCards.slice(0, 3)
    : [
        { name: 'Jane Doe', title: 'Jane Doe', preview: 'Re: Campaign confirmation needed', avatar: 'JD', time: '2m' },
        { name: 'Raj Kumar', title: 'Raj Kumar', preview: 'Thanks for the warm-up setup', avatar: 'RK', time: '1h' },
        { name: 'Maria L.', title: 'Maria L.', preview: 'Question about delivery rates', avatar: 'ML', time: '3h' }
      ];

  return (
    <>
      <div className="grid-3 middle-grid">
        <SalesActionCenter
          today={today}
          todayCalendarEvents={todayCalendarEvents}
          upcomingCalendarEvents={upcomingCalendarEvents}
          notificationCards={notificationCards}
          paginatedCampaigns={paginatedCampaigns}
          openEventForm={openEventForm}
          setShowNotesPopup={setShowNotesPopup}
          addQuickNote={addQuickNote}
          onShowMessage={onShowMessage}
        />
        {/* Calendar Panel */}
        <div className="panel">
          <div className="cal-header">
            <span className="cal-month">{monthLabel}</span>
            <div className="cal-nav-btns">
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="cal-nav"
                onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
          </div>
          <div className="cal-grid">
            {weekdayLabels.map((label) => (
              <div key={label} className="cal-day-name">
                {label}
              </div>
            ))}
            {calendarCells.map((day) => {
              const dayEvents = allCalendarEvents.filter((item) => sameDay(item.date, day.date));
              return (
                <button
                  key={day.key}
                  type="button"
                  className={`cal-day ${day.inMonth ? '' : 'other-month'} ${sameDay(day.date, selectedDate) || sameDay(day.date, today) ? 'today' : ''} ${dayEvents.length ? 'has-event' : ''}`}
                  onClick={(event) => {
                    setSelectedDate(day.date);
                    openAnchoredPopup('day', setShowDayPopup)(event);
                  }}
                  title={dayEvents.length ? dayEvents.map((item) => `${item.type}: ${item.title}`).slice(0, 3).join('\n') : ''}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <div className="premium-calendar-events">
            <div className="premium-calendar-events-head">
              <strong>{selectedDate.toLocaleDateString('en-GB')}</strong>
              <span className="premium-calendar-loading">{calendarLoading ? 'Loading...' : `${selectedEvents.length} events`}</span>
              {selectedEvents.length ? (
                <button
                  type="button"
                  className="premium-calendar-more"
                  onClick={(event) => openAnchoredPopup('calendar', setShowCalendarPopup)(event)}
                >
                  See more ({selectedEvents.length})
                </button>
              ) : null}
              <button type="button" className="ghost subtle premium-calendar-add" onClick={() => openEventForm(selectedDate)}>
                Add Event
              </button>
            </div>
            {selectedEvents.length ? (
              selectedEvents.slice(0, 3).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="premium-calendar-event premium-calendar-event-button"
                  onClick={() => openEventForm(selectedDate, item)}
                  style={{ '--event-color': item.color || '#2563eb' }}
                >
                  <span>{item.type}</span>
                  <p>{item.title}</p>
                  <small>{item.startTime || 'All day'}{item.priority ? ` • ${item.priority}` : ''}</small>
                </button>
              ))
            ) : (
              <p>No events for this date.</p>
            )}
            <div className="premium-calendar-dashboard-summary">
              <span><strong>{todayCalendarEvents.length}</strong> Today</span>
              <span><strong>{upcomingTaskCount}</strong> Tasks</span>
              <span><strong>{upcomingCampaignCount}</strong> Campaigns</span>
              <span><strong>{upcomingMeetingCount}</strong> Meetings</span>
            </div>
            {upcomingCalendarEvents.length ? (
              <div className="premium-calendar-upcoming-list">
                {upcomingCalendarEvents.slice(0, 2).map((item) => (
                  <button
                    type="button"
                    key={`upcoming-${item.id}`}
                    onClick={() => {
                      setSelectedDate(item.date);
                      if (item.date) setCalendarCursor(new Date(item.date.getFullYear(), item.date.getMonth(), 1));
                    }}
                  >
                    <span style={{ background: item.color || '#2563eb' }} />
                    <strong>{item.title}</strong>
                    <small>{item.date.toLocaleDateString('en-GB')}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Inbox Panel */}
        <section className="panel dashboard-inbox-card">
          <div className="section-header">
            <span className="section-title">Inbox</span>
            <button type="button" className="section-link" onClick={(event) => openAnchoredPopup('notifications', setShowNotificationsPopup)(event)}>
              See All <i className="ti ti-arrow-right" style={{ fontSize: 12 }}></i>
            </button>
          </div>
          <div className="dashboard-inbox-scroll">
            {referenceInboxItems.map((item, index) => (
              <NotificationItem key={`${item.name}-${index}`} item={item} onClick={() => openInboxMail(item)} />
            ))}
          </div>
        </section>

        {/* Write Note Panel */}
        <section className="panel dashboard-note-card">
          <div className="section-title" style={{ marginBottom: 10 }}>Write Note</div>
          <div className="dashboard-note-body">
            <div className="note-row">
              <input
                className="note-input"
                type="text"
                value={noteTopic}
                onChange={(event) => setNoteTopic(event.target.value)}
                placeholder="Topic"
              />
              <input
                className="note-input"
                type="text"
                value={noteTag}
                onChange={(event) => setNoteTag(event.target.value)}
                placeholder="Tag"
              />
            </div>
            <textarea
              className="note-textarea"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Write a quick note..."
            />
            <div className="note-footer">
              <span className="note-fields-count">{[noteTopic, noteTag, noteDraft].map((value) => value.trim()).filter(Boolean).length} fields filled</span>
              <div className="note-btns">
                <button type="button" className="btn-ghost" onClick={() => setShowNotesPopup(true)}>
                  Show Notes
                </button>
                <button type="button" className="btn-primary" onClick={addQuickNote}>Save Note</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Broadcast Performance Table */}
      <section className="table-card" id="all-broadcast-performance" ref={broadcastPerformanceRef}>
        <div className="table-header">
          <span className="table-title">All Broadcast Performance</span>
          <button type="button" className="tab-pill active" onClick={handleSelectionSummaryClick}>{selectedRows.length ? `${selectedRows.length} Selected` : 'All Campaigns'}</button>
          <button type="button" className="tab-pill premium-broadcast-tag-filter" onClick={openTagFilterMenu}>{selectedTagFilterLabel}</button>
          <div className="search-wrapper">
            <i className="ti ti-search si"></i>
            <input
              className="table-search"
              type="text"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Search campaigns, person, country, sector..."
            />
          </div>
          <button type="button" className="action-center-btn" onClick={handleActionCenterClick}>
            <i className="ti ti-layout-grid"></i> {selectedRows.length ? 'Take Action' : 'Action Center'}
          </button>
          <button type="button" className="icon-btn" onClick={() => onRefreshCampaigns?.()} disabled={campaignRefreshing} title="Refresh">
            <i className="ti ti-refresh"></i>
          </button>
        </div>
        <>
          <div className="premium-table-actions reference-hidden-table-actions">
            <button type="button" onClick={handleSelectionSummaryClick}>{selectedRows.length ? `${selectedRows.length} Selected` : 'All Campaign'}</button>
            <div className="premium-broadcast-tag-filter-wrap" ref={tagFilterRef}>
              <button
                type="button"
                className="premium-broadcast-tag-filter"
                onClick={openTagFilterMenu}
              >
                {selectedTagFilterLabel}
              </button>
            </div>
            <input
              type="text"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="Search campaigns, person, country, sector, tags..."
            />
            <button type="button" className="subtle" onClick={handleActionCenterClick}>{selectedRows.length ? 'Take Action' : 'Action Center'}</button>
          </div>
          <div className="table-wrap broadcast-performance-table-wrap">
          <table className="data-table broadcast-performance-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={paginatedCampaigns.length > 0 && paginatedCampaigns.every((campaign) => selectedRows.includes(campaign.id))} onChange={toggleAllRows} /></th>
                <th>SR.</th>
                <th>Campaign</th>
                <th>Project</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Scheduled Date</th>
                <th>Created By</th>
                <th>Created Date</th>
                <th>Publish Date</th>
                <th>Total Mails</th>
                <th>Sent</th>
                <th>Pending</th>
                <th>Fail</th>
                <th>Open</th>
                <th>Bounce</th>
                <th>Spam</th>
                <th>Tags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCampaigns.length ? paginatedCampaigns.map((campaign, index) => {
                const normalizedStatus = String(campaign.status || campaign.tag || '').toLowerCase();
                const statusClass =
                  normalizedStatus.includes('complete') || normalizedStatus === 'done'
                    ? 'tag-completed'
                    : normalizedStatus.includes('run')
                      ? 'tag-running'
                      : normalizedStatus.includes('schedule')
                        ? 'tag-scheduled'
                        : normalizedStatus.includes('fail') || normalizedStatus.includes('stop')
                          ? 'tag-failed'
                          : normalizedStatus.includes('draft')
                            ? 'tag-draft'
                            : 'tag-pending';
                return (
                  <tr key={campaign.id || campaign._id || index}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(campaign.id)}
                        onChange={() => toggleRowSelection(campaign.id)}
                        aria-label={`Select ${campaign.name}`}
                      />
                    </td>
                    <td>{campaign.srNo || index + 1}</td>
                    <td>
                      <button type="button" className="campaign-link" onClick={() => handleViewCampaign(campaign)}>
                        {campaign.name}
                      </button>
                    </td>
                    <td>{campaign.project || '-'}</td>
                    <td><span className={`tag-pill ${statusClass}`}>{campaign.status || campaign.tag || 'Pending'}</span></td>
                    <td>{Number(campaign.total || 0).toLocaleString()}</td>
                    <td>{campaign.scheduledDate || '-'}</td>
                    <td>{campaign.createdBy || '-'}</td>
                    <td>{campaign.createdDate || '-'}</td>
                    <td>{campaign.publishDate || '-'}</td>
                    <td>{campaign.total}</td>
                    <td>{campaign.sent}</td>
                    <td>{campaign.pending}</td>
                    <td>{campaign.failed}</td>
                    <td>{campaign.open}</td>
                    <td>{campaign.bounced}</td>
                    <td>{campaign.spam}</td>
                    <td>
                      <span className={`tag-pill ${statusClass}`}>{campaign.status || campaign.tag || 'Pending'}</span>
                      {(campaign.tags || [])
                        .filter((tag) => String(tag || '').trim().toLowerCase() !== normalizedStatus)
                        .slice(0, 1)
                        .map((tag) => (
                        <span key={tag} className="country-tag" style={{ marginLeft: 4 }}>{tag}</span>
                      ))}
                    </td>
                    <td className="broadcast-action-cell" ref={openActionMenu === campaign.id ? actionMenuRef : null}>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setOpenActionMenu(openActionMenu === campaign.id ? null : campaign.id);
                        }}
                        aria-label={`Open actions for ${campaign.name}`}
                      >
                        <i className="ti ti-dots-vertical"></i>
                      </button>
                      {openActionMenu === campaign.id ? (
                        <div className="premium-row-action-menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={(event) => { event.stopPropagation(); handleViewCampaign(campaign); }}>View</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); handleEditTagsClick(campaign); }}>Edit Tags</button>
                          {normalizedStatus === 'draft' ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); resumeCampaignDraft(campaign); }}>
                              Resume Draft
                            </button>
                          ) : null}
                          {['queued', 'running'].includes(normalizedStatus) ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onPauseCampaign?.(campaign.id); }}>Pause</button>
                          ) : null}
                          {['queued', 'running', 'paused'].includes(normalizedStatus) ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onStopCampaign?.(campaign.id); }}>Stop</button>
                          ) : null}
                          {normalizedStatus === 'paused' ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onResumeCampaign?.(campaign.id); }}>Resume</button>
                          ) : null}
                          <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteCampaignClick(campaign); }}>Delete</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              }) : (
                Array.from({ length: 7 }, (_, index) => (
                  <tr key={`empty-data-row-${index}`}>
                    <td><input type="checkbox" disabled aria-label="No row available" /></td>
                    <td>{index + 1}</td>
                    <td colSpan={17} className="empty-row" style={{ textAlign: 'left', color: 'var(--text-3)', fontStyle: 'italic' }}>No data</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          <div className="table-footer">
            <div className="tf-left">
              <input
                type="checkbox"
                id="selectAll"
                checked={paginatedCampaigns.length > 0 && paginatedCampaigns.every((campaign) => selectedRows.includes(campaign.id))}
                onChange={toggleAllRows}
              />
              <label htmlFor="selectAll">Select all visible rows</label>
            </div>
            <div className="pagination">
              <button
                type="button"
                className="page-btn arrow"
                onClick={() => setCurrentTablePage((page) => Math.max(1, page - 1))}
                disabled={currentTablePage === 1}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 12 }}></i>
              </button>
              {Array.from({ length: totalTablePages }, (_, index) => (
                <button
                  key={index + 1}
                  type="button"
                  className={`page-btn ${currentTablePage === index + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentTablePage(index + 1)}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                className="page-btn arrow"
                onClick={() => setCurrentTablePage((page) => Math.min(totalTablePages, page + 1))}
                disabled={currentTablePage === totalTablePages}
              >
                <i className="ti ti-chevron-right" style={{ fontSize: 12 }}></i>
              </button>
            </div>
          </div>

          <div className="premium-table-wrap">
            <div className="premium-table premium-table-head">
              {['', 'Sr. No.', 'Campaign', 'Publish Date', 'Total Mails', 'Sent', 'Pending', 'Fail', 'Open', 'Bounce', 'Spam', 'Tags', 'Action'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            {paginatedCampaigns.length ? paginatedCampaigns.map((campaign, index) => (
              <div
                key={campaign.id || campaign._id || index}
                className={`premium-table premium-table-row ${openActionMenu === campaign.id ? 'premium-table-row-menu-open' : ''}`}
              >
                <span data-label="Select">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(campaign.id)}
                    onChange={() => toggleRowSelection(campaign.id)}
                    aria-label={`Select ${campaign.name}`}
                  />
                </span>
                <span data-label="Sr. No.">{campaign.srNo}</span>
                <span className="premium-table-campaign" data-label="Campaign">
                  {(() => {
                    const normalizedStatus = String(campaign.status || campaign.tag || '').toLowerCase();
                    const isDraftCampaign = normalizedStatus === 'draft';
                    const isQueuedCampaign = normalizedStatus === 'queued';
                    return (
                      <>
                        <strong>{campaign.name}</strong>
                        <small>Status: {campaign.status || campaign.tag || 'Unknown'}</small>
                        {isDraftCampaign ? (
                          <button
                            type="button"
                            className="campaign-resume-badge"
                            onClick={() => resumeCampaignDraft(campaign)}
                          >
                            Resume from: {campaign.workflowStepLabel || `Step ${campaign.workflowStep || 1}`}
                          </button>
                        ) : null}
                        {isQueuedCampaign ? (
                          <button
                            type="button"
                            className="campaign-resume-badge"
                            onClick={() => handleViewCampaign(campaign)}
                          >
                            Queued for worker
                          </button>
                        ) : null}
                        <small>{[campaign.person, campaign.broadcast].filter(Boolean).join(' | ') || 'Campaign details available below'}</small>
                        <small>{[campaign.country, campaign.sector].filter(Boolean).join(' | ') || 'Location and sector not set'}</small>
                      </>
                    );
                  })()}
                </span>
                <span data-label="Publish Date">{campaign.publishDate || '-'}</span>
                <span data-label="Total Mails">{campaign.total}</span>
                <span data-label="Sent">{campaign.sent}</span>
                <span data-label="Pending">{campaign.pending}</span>
                <span data-label="Fail">{campaign.failed}</span>
                <span data-label="Open">{campaign.open}</span>
                <span data-label="Bounce">{campaign.bounced}</span>
                <span data-label="Spam">{campaign.spam}</span>
                <span className="premium-tag-stack" data-label="Tags">
                  {(campaign.tags || []).slice(0, 2).map((tag) => (
                    <em key={tag}>{tag}</em>
                  ))}
                </span>
                <span className="premium-table-action-cell" data-label="Action" ref={openActionMenu === campaign.id ? actionMenuRef : null}>
                  <button
                    type="button"
                    className="premium-row-action"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpenActionMenu(openActionMenu === campaign.id ? null : campaign.id);
                    }}
                    aria-label={`Open actions for ${campaign.name}`}
                  >
                    ⋮
                  </button>
                  {openActionMenu === campaign.id ? (() => {
                    const normalizedStatus = String(campaign.status || campaign.tag || '').toLowerCase();
                    const isDraftCampaign = normalizedStatus === 'draft';
                    const canPauseCampaign = ['queued', 'running'].includes(normalizedStatus);
                    const canStopCampaign = ['queued', 'running', 'paused'].includes(normalizedStatus);
                    const canResumeCampaign = normalizedStatus === 'paused';
                    return (
                      <div className="premium-row-action-menu" onClick={(event) => event.stopPropagation()}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); handleViewCampaign(campaign); }}>View</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); handleEditTagsClick(campaign); }}>Edit Tags</button>
                        {isDraftCampaign ? (
                          <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); resumeCampaignDraft(campaign); }}>
                            Resume Draft
                          </button>
                        ) : null}
                        {canPauseCampaign ? (
                          <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onPauseCampaign?.(campaign.id); }}>Pause</button>
                        ) : null}
                        {canStopCampaign ? (
                          <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onStopCampaign?.(campaign.id); }}>Stop</button>
                        ) : null}
                        {canResumeCampaign ? (
                          <button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu(null); onResumeCampaign?.(campaign.id); }}>Resume</button>
                        ) : null}
                        <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteCampaignClick(campaign); }}>Delete</button>
                      </div>
                    );
                  })() : null}
                </span>
              </div>
            )) : (
              <>
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={`empty-row-${index}`} className="premium-table premium-table-row premium-table-row-empty">
                    <span data-label="Select">
                      <input
                        type="checkbox"
                        disabled
                        aria-label="No row available"
                      />
                    </span>
                    <span>{index + 1}</span>
                    <span data-label="Campaign">—</span>
                    <span data-label="Publish Date">—</span>
                    <span data-label="Total Mails">—</span>
                    <span data-label="Sent">—</span>
                    <span data-label="Pending">—</span>
                    <span data-label="Fail">—</span>
                    <span data-label="Open">—</span>
                    <span data-label="Bounce">—</span>
                    <span data-label="Spam">—</span>
                    <span className="premium-tag-stack" data-label="Tags">
                      <em className="premium-table-empty-tag">No data</em>
                    </span>
                    <span className="premium-table-action-cell" data-label="Action">
                      <button type="button" className="premium-row-action" disabled aria-label="No actions available">
                        ⋮
                      </button>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="premium-table-footer">
            <label className="premium-table-bulk">
              <input
                type="checkbox"
                checked={paginatedCampaigns.length > 0 && paginatedCampaigns.every((campaign) => selectedRows.includes(campaign.id))}
                onChange={toggleAllRows}
              />
              <span>Select all visible rows</span>
            </label>
            <div className="premium-table-pagination">
              <button
                type="button"
                onClick={() => setCurrentTablePage((page) => Math.max(1, page - 1))}
                disabled={currentTablePage === 1}
              >
                ‹ Back
              </button>
              {Array.from({ length: totalTablePages }, (_, index) => (
                <button
                  key={index + 1}
                  type="button"
                  className={currentTablePage === index + 1 ? 'active' : ''}
                  onClick={() => setCurrentTablePage(index + 1)}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentTablePage((page) => Math.min(totalTablePages, page + 1))}
                disabled={currentTablePage === totalTablePages}
              >
                Next ›
              </button>
            </div>
          </div>
        </>
      </section>
    </>
  );
}
