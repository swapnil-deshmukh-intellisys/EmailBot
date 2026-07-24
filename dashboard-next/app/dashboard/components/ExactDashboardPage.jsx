import React, { useState } from 'react';

const sidebarGroups = [
  {
    label: 'Main',
    items: [
      ['Dashboard', 'ti-layout-dashboard', '/dashboard/user', true],
      ['Campaigns', 'ti-send', '/campaigns'],
      ['Drafts', 'ti-file-text', '/drafts'],
      ['Client Data', 'ti-users', '/client-data'],
      ['Sender IDs', 'ti-user-circle', '/sender-emails'],
      ['Warm-up', 'ti-flame', '/warm-up'],
      ['Master Inbox', 'ti-mail', '/mail-inbox'],
      ['Templates', 'ti-template', '/draft-templates']
    ]
  },
  {
    label: 'Performance',
    items: [
      ['All Broadcast Performance', 'ti-broadcast', '/dashboard/broadcasts'],
      ['Reports & Analytics', 'ti-chart-line', '/report'],
      ['Delivery Logs', 'ti-clipboard-list', '/dashboard/user?view=logs']
    ]
  },
  {
    label: 'Sales & Action',
    items: [
      ['Sales Action Center', 'ti-target-arrow', '/dashboard/user?view=sales'],
      ['Daily Work Report', 'ti-calendar-stats', '/dashboard/user?view=work-report'],
      ['To-Do List', 'ti-list-check', '/dashboard/user?view=todo'],
      ['Activity Timeline', 'ti-timeline', '/dashboard/user?view=timeline'],
      ['Daily Timeline & Planning', 'ti-calendar-time', '/dashboard/user?view=planning']
    ]
  },
  {
    label: 'Account & Settings',
    items: [
      ['Profile & Settings', 'ti-user-cog', '/dashboard/user/profile/settings'],
      ['Team & Users', 'ti-users-group', '/dashboard/user/profile/team'],
      ['Billing & Credits', 'ti-credit-card', '/dashboard/user/profile/billing'],
      ['Integrations', 'ti-plug', '/dashboard/user/profile/integrations']
    ]
  }
];

const workflow = [
  ['Upload List', 'Upload List', 'ti-upload'],
  ['Review', 'Review List', 'ti-users'],
  ['Campaign', 'Campaign', 'ti-megaphone'],
  ['Drafts', 'Select Draft', 'ti-file-text'],
  ['Draft Summary', 'Summary', 'ti-layout-list'],
  ['Test Email', 'Test Email', 'ti-mail-check'],
  ['Schedule', 'Schedule', 'ti-calendar-event']
];


export default function ExactDashboardPage({
  onCreateCampaign,
  onNavigate,
  onSidebarToggle,
  user = {},
  topbar = {},
  onProjectChange,
  onSenderChange,
  onRangeChange,
  statsItems,
  workflowItems,
  onWorkflowStep,
  dailyCounts,
  statusLegend,
  totalCampaigns,
  campaignRows,
  onCampaignAction,
  todoItems,
  todoStats,
  todoLoading,
  onTodoAdd,
  onTodoEdit,
  onTodoDelete,
  onTodoComplete,
  onTodoViewAll,
  scheduleItems,
  onScheduleViewAll,
  activityItems,
  onActivityViewAll
}) {
  const [todoTab, setTodoTab] = useState('To-Do');
  const displayStats = Array.isArray(statsItems) ? statsItems : [];
  const displayWorkflow = Array.isArray(workflowItems) && workflowItems.length ? workflowItems : workflow;
  const displayCampaigns = (Array.isArray(campaignRows) ? campaignRows : []).map((item) => Array.isArray(item) ? item : [item.name, item.type, item.project, item.status, item.recipients, item.sent, item.openRate, item.replyRate, item.scheduled, item]);
  const displayTodos = (Array.isArray(todoItems) ? todoItems : []).map((item) => Array.isArray(item) ? item : [item.title, item.time, item.priority, item]);
  const displaySchedules = (Array.isArray(scheduleItems) ? scheduleItems : []).map((item) => Array.isArray(item) ? item : [item.time, item.date, item.title, item.meta, item]);
  const displayActivities = (Array.isArray(activityItems) ? activityItems : []).map((item) => Array.isArray(item) ? item : [item.time, item.date, item.title, item.meta, item.icon, item.tone, item]);
  const displayDailyCounts = Array.isArray(dailyCounts) && dailyCounts.length ? dailyCounts : [];
  const displayStatusLegend = Array.isArray(statusLegend) && statusLegend.length ? statusLegend : [
    ['Running', '#10b981', '0 (0%)'],
    ['Scheduled', '#2563eb', '0 (0%)'],
    ['Paused', '#f59e0b', '0 (0%)'],
    ['Draft', '#cbd5e1', '0 (0%)']
  ];
  const maxDailyCount = Math.max(1, ...displayDailyCounts.map((item) => Number(item.value || 0)));
  const chartPoints = displayDailyCounts.length
    ? displayDailyCounts.map((item, index) => {
        const x = 42 + (index * (578 / Math.max(1, displayDailyCounts.length - 1)));
        const y = 190 - ((Number(item.value || 0) / maxDailyCount) * 130);
        return { x, y, label: item.label };
      })
    : [];
  const chartLinePath = chartPoints.length
    ? chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : 'M 42 155 L 148 154 L 250 112 L 350 73 L 462 103 L 560 145 L 620 126';
  const chartAreaPath = `${chartLinePath} L 620 210 L 42 210 Z`;
  const navigate = (href) => {
    if (typeof onNavigate === 'function') onNavigate(href);
    else if (typeof window !== 'undefined') window.location.href = href;
  };

  return (
    <div className="ip-exact-shell">
      <style>{`
        html body main.dashboard-shell > aside.dashboard-sidebar,
        html body main.dashboard-shell > div.main.dashboard-main > header.dashboard-topbar,
        html body main.dashboard-shell > .dashboard-sidebar-backdrop,
        html body main.dashboard-shell > .dashboard-legacy-sidebar-toggle {
          display: none !important;
        }
        html body main.dashboard-shell > div.main.dashboard-main {
          width: 100% !important;
          max-width: 100% !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        html body main.dashboard-shell.dashboard-exact-only {
          width: 100% !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
          overflow-x: hidden !important;
          background: #ffffff !important;
        }
        html body main.dashboard-shell .ip-exact-shell,
        html body main.dashboard-shell .ip-exact-shell * {
          box-sizing: border-box !important;
          font-family: Inter, "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          letter-spacing: 0 !important;
        }
        html body main.dashboard-shell .ip-exact-shell {
          --purple: #4f46e5;
          --ink: #071333;
          --muted: #62708f;
          --line: #e4e9f4;
          display: grid !important;
          grid-template-columns: 216px minmax(0, 1fr) !important;
          min-height: 100vh !important;
          width: 100% !important;
          background: #ffffff !important;
          color: var(--ink) !important;
          overflow-x: hidden !important;
        }
        .ip-exact-sidebar {
          border-right: 1px solid #e8ecf5 !important;
          background: #ffffff !important;
          min-height: 100vh !important;
          display: flex !important;
          flex-direction: column !important;
          overflow-y: auto !important;
        }
        .ip-exact-logo {
          height: 64px !important;
          padding: 0 18px !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
        }
        .ip-exact-logo-mark {
          width: 31px !important;
          height: 31px !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 8px !important;
          background: var(--purple) !important;
          color: #fff !important;
          font-size: 17px !important;
        }
        .ip-exact-logo strong {
          display: block !important;
          font-size: 20px !important;
          line-height: 1 !important;
          font-weight: 950 !important;
          color: var(--ink) !important;
        }
        .ip-exact-logo span {
          color: var(--purple) !important;
        }
        .ip-exact-logo small {
          display: block !important;
          margin-top: 2px !important;
          color: #94a3b8 !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          letter-spacing: .12em !important;
        }
        .ip-exact-search {
          margin: 8px 15px 18px !important;
          height: 32px !important;
          border: 1px solid #e8ecf5 !important;
          border-radius: 8px !important;
          background: #fbfcff !important;
          display: flex !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 0 11px !important;
          color: #94a3b8 !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }
        .ip-exact-nav-label {
          margin: 16px 22px 8px !important;
          color: #7b86a4 !important;
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          letter-spacing: .045em !important;
          text-transform: uppercase !important;
        }
        .ip-exact-nav-link {
          height: 36px !important;
          margin: 1px 12px !important;
          padding: 0 12px !important;
          border-radius: 7px !important;
          border: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          background: transparent !important;
          color: #24304f !important;
          text-decoration: none !important;
          font-size: 12px !important;
          line-height: 1 !important;
          font-weight: 850 !important;
          box-shadow: none !important;
        }
        .ip-exact-nav-link.active {
          background: #f0edff !important;
          color: var(--purple) !important;
          box-shadow: inset 3px 0 0 var(--purple) !important;
        }
        .ip-exact-nav-link i {
          width: 16px !important;
          min-width: 16px !important;
          font-size: 16px !important;
          color: currentColor !important;
        }
        .ip-exact-main {
          min-width: 0 !important;
          background: #ffffff !important;
          overflow-x: hidden !important;
        }
        .ip-exact-topbar {
          height: 64px !important;
          padding: 0 24px !important;
          border-bottom: 1px solid #e8ecf5 !important;
          display: flex !important;
          align-items: center !important;
          gap: 13px !important;
          background: #ffffff !important;
          min-width: 0 !important;
        }
        .ip-top-control {
          height: 42px !important;
          min-width: 194px !important;
          padding: 6px 10px !important;
          border: 1px solid #e3e8f4 !important;
          border-radius: 8px !important;
          display: grid !important;
          grid-template-columns: 26px minmax(0, 1fr) 12px !important;
          grid-template-rows: 13px 18px !important;
          column-gap: 9px !important;
          align-items: center !important;
          background: #ffffff !important;
        }
        .ip-top-control.sender { min-width: 262px !important; }
        .ip-top-control.date { min-width: 224px !important; margin-left: auto !important; }
        .ip-top-control > i {
          grid-row: 1 / 3 !important;
          width: 26px !important;
          height: 26px !important;
          border-radius: 8px !important;
          display: grid !important;
          place-items: center !important;
          background: #f1efff !important;
          color: var(--purple) !important;
          font-size: 15px !important;
        }
        .ip-top-control span {
          color: #4b5878 !important;
          font-size: 9px !important;
          font-weight: 900 !important;
        }
        .ip-top-control strong {
          grid-column: 2 / 4 !important;
          color: var(--ink) !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .ip-top-toggle {
          height: 30px !important;
          width: 64px !important;
          padding: 3px !important;
          border: 1px solid #e5e9f4 !important;
          border-radius: 999px !important;
          display: flex !important;
          gap: 3px !important;
          background: #f8fafc !important;
        }
        .ip-top-toggle button,
        .ip-bell,
        .ip-create,
        .ip-card button {
          box-shadow: none !important;
          outline: 0 !important;
        }
        .ip-top-toggle button {
          width: 25px !important;
          height: 25px !important;
          min-height: 25px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          background: #fff !important;
          color: #f59e0b !important;
        }
        .ip-bell {
          position: relative !important;
          width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: #34405f !important;
        }
        .ip-bell span {
          position: absolute !important;
          top: -2px !important;
          right: -2px !important;
          width: 17px !important;
          height: 17px !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          background: var(--purple) !important;
          color: #fff !important;
          font-size: 9px !important;
          font-weight: 900 !important;
        }
        .ip-user {
          width: 158px !important;
          height: 42px !important;
          display: grid !important;
          grid-template-columns: 34px 1fr 10px !important;
          grid-template-rows: 18px 14px !important;
          column-gap: 10px !important;
          align-items: center !important;
        }
        .ip-user-avatar {
          grid-row: 1 / 3 !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          background: var(--purple) !important;
          color: #fff !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }
        .ip-user strong {
          color: var(--ink) !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .ip-user small {
          color: #64748b !important;
          font-size: 10px !important;
          font-weight: 700 !important;
        }
        .ip-create {
          height: 38px !important;
          min-height: 38px !important;
          padding: 0 17px !important;
          border: 0 !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          background: var(--purple) !important;
          color: #fff !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          box-shadow: 0 10px 18px rgba(79,70,229,.24) !important;
        }
        .ip-content {
          max-width: 1280px !important;
          margin: 0 auto !important;
          padding: 14px 20px 14px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 13px !important;
          width: 100% !important;
          min-width: 0 !important;
        }
        .ip-welcome {
          height: 42px !important;
        }
        .ip-welcome h1 {
          margin: 0 0 5px !important;
          color: var(--ink) !important;
          font-size: 21px !important;
          line-height: 1.05 !important;
          font-weight: 950 !important;
          letter-spacing: -.02em !important;
        }
        .ip-welcome p {
          margin: 0 !important;
          color: #43516f !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }
        .ip-stats {
          display: grid !important;
          grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          gap: 12px !important;
        }
        .ip-stat {
          height: 105px !important;
          padding: 17px 16px !important;
          border: 1px solid var(--line) !important;
          border-radius: 9px !important;
          background: #fff !important;
          display: grid !important;
          grid-template-columns: 48px minmax(0, 1fr) !important;
          gap: 13px !important;
          align-items: center !important;
          box-shadow: 0 8px 18px rgba(15,23,42,.025) !important;
        }
        .ip-stat-icon {
          width: 46px !important;
          height: 46px !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          font-size: 23px !important;
        }
        .ip-stat.purple .ip-stat-icon { background: #f0edff !important; color: var(--purple) !important; }
        .ip-stat.green .ip-stat-icon { background: #dcfce7 !important; color: #10b981 !important; }
        .ip-stat.orange .ip-stat-icon { background: #ffedd5 !important; color: #f97316 !important; }
        .ip-stat.red .ip-stat-icon { background: #ffe4e6 !important; color: #ef4444 !important; }
        .ip-stat.blue .ip-stat-icon { background: #eaf2ff !important; color: #2563eb !important; }
        .ip-stat.amber .ip-stat-icon { background: #fff1df !important; color: #f97316 !important; }
        .ip-stat label {
          display: block !important;
          margin-bottom: 5px !important;
          color: #111a3a !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }
        .ip-stat strong {
          display: block !important;
          color: var(--ink) !important;
          font-size: 20px !important;
          line-height: 1 !important;
          font-weight: 950 !important;
          white-space: nowrap !important;
        }
        .ip-stat small {
          display: block !important;
          margin-top: 14px !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          color: #43516f !important;
          line-height: 1.25 !important;
        }
        .ip-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 390px !important;
          gap: 15px !important;
          align-items: start !important;
        }
        .ip-left,
        .ip-right {
          display: flex !important;
          flex-direction: column !important;
          min-width: 0 !important;
        }
        .ip-left { gap: 13px !important; }
        .ip-right { gap: 10px !important; }
        .ip-card {
          border: 1px solid var(--line) !important;
          border-radius: 9px !important;
          background: #fff !important;
          overflow: hidden !important;
          box-shadow: 0 8px 18px rgba(15,23,42,.025) !important;
        }
        .ip-card-head {
          min-height: 48px !important;
          padding: 0 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 12px !important;
        }
        .ip-card-head h3 {
          margin: 0 !important;
          color: var(--ink) !important;
          font-size: 13px !important;
          font-weight: 950 !important;
        }
        .ip-card-head p {
          margin: 4px 0 0 !important;
          color: #66728f !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }
        .ip-card-head button,
        .ip-step-action {
          height: 24px !important;
          min-height: 24px !important;
          padding: 0 10px !important;
          border: 1px solid #e5e0ff !important;
          border-radius: 999px !important;
          background: #fff !important;
          color: var(--purple) !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }
        .ip-workflow {
          height: 154px !important;
        }
        .ip-steps {
          height: 96px !important;
          padding: 0 28px 12px !important;
          display: grid !important;
          grid-template-columns: repeat(6, 1fr) !important;
          align-items: start !important;
        }
        .ip-step {
          position: relative !important;
          display: grid !important;
          justify-items: center !important;
          gap: 6px !important;
        }
        .ip-step-line {
          position: absolute !important;
          top: 22px !important;
          left: calc(50% + 23px) !important;
          width: calc(100% - 46px) !important;
          height: 2px !important;
          background: #d9e1f0 !important;
        }
        .ip-step:first-child .ip-step-line {
          background: #b3adff !important;
        }
        .ip-step-circle {
          position: relative !important;
          z-index: 1 !important;
          width: 46px !important;
          height: 46px !important;
          min-height: 46px !important;
          padding: 0 !important;
          border: 1px solid #d9e1f0 !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          background: #fff !important;
          color: #64748b !important;
          font-size: 21px !important;
        }
        .ip-step:first-child .ip-step-circle {
          background: var(--purple) !important;
          border-color: var(--purple) !important;
          color: #fff !important;
          box-shadow: 0 10px 18px rgba(79,70,229,.22) !important;
        }
        .ip-step-circle em {
          position: absolute !important;
          top: -7px !important;
          right: -2px !important;
          width: 16px !important;
          height: 16px !important;
          border-radius: 999px !important;
          display: grid !important;
          place-items: center !important;
          background: #fff !important;
          border: 1px solid #cfd7ea !important;
          color: #66728f !important;
          font-size: 9px !important;
          font-style: normal !important;
          font-weight: 900 !important;
        }
        .ip-step:first-child .ip-step-circle em {
          background: var(--purple) !important;
          border-color: var(--purple) !important;
          color: #fff !important;
        }
        .ip-step strong {
          color: var(--ink) !important;
          font-size: 11px !important;
          font-weight: 950 !important;
        }
        .ip-chart-row {
          display: grid !important;
          grid-template-columns: minmax(0, 1.08fr) minmax(300px, .75fr) !important;
          gap: 13px !important;
        }
        .ip-line,
        .ip-donut-card {
          height: 231px !important;
        }
        .ip-line-body {
          padding: 0 18px 12px !important;
        }
        .ip-line-body svg {
          width: 100% !important;
          height: 160px !important;
          display: block !important;
        }
        .ip-axis {
          display: grid !important;
          grid-template-columns: repeat(10, 1fr) !important;
          margin-top: -4px !important;
          color: #273657 !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          text-align: center !important;
        }
        .ip-donut-layout {
          display: grid !important;
          grid-template-columns: 138px 1fr !important;
          gap: 18px !important;
          align-items: center !important;
          padding: 24px 18px 10px !important;
        }
        .ip-donut {
          width: 125px !important;
          height: 125px !important;
          border-radius: 50% !important;
          position: relative !important;
          background: conic-gradient(#10b981 0 38%, #2563eb 38% 71%, #f59e0b 71% 90%, #cbd5e1 90% 100%) !important;
        }
        .ip-donut::after {
          content: "" !important;
          position: absolute !important;
          inset: 35px !important;
          border-radius: 50% !important;
          background: #fff !important;
        }
        .ip-legend {
          display: grid !important;
          gap: 13px !important;
        }
        .ip-legend-row {
          display: grid !important;
          grid-template-columns: auto 1fr auto !important;
          gap: 10px !important;
          align-items: center !important;
          color: var(--ink) !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }
        .ip-dot {
          width: 10px !important;
          height: 10px !important;
          border-radius: 999px !important;
        }
        .ip-total {
          display: flex !important;
          justify-content: space-between !important;
          padding: 0 18px !important;
          color: var(--ink) !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }
        .ip-table-card {
          min-height: 268px !important;
        }
        .ip-table-card .ip-card-head {
          min-height: 42px !important;
        }
        .ip-table-wrap {
          overflow-x: auto !important;
          max-width: 100% !important;
          scrollbar-width: thin !important;
        }
        .ip-table {
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          table-layout: fixed !important;
        }
        .ip-table th {
          height: 30px !important;
          padding: 0 8px !important;
          border-bottom: 1px solid #eef2f7 !important;
          color: #4b5878 !important;
          font-size: 8px !important;
          font-weight: 900 !important;
          text-align: left !important;
          text-transform: uppercase !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .ip-table td {
          height: 39px !important;
          padding: 4px 8px !important;
          border-bottom: 1px solid #eef2f7 !important;
          color: var(--ink) !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          vertical-align: middle !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .ip-table th:nth-child(1), .ip-table td:nth-child(1) { width: 25% !important; }
        .ip-table th:nth-child(2), .ip-table td:nth-child(2) { width: 8% !important; }
        .ip-table th:nth-child(3), .ip-table td:nth-child(3) { width: 10% !important; }
        .ip-table th:nth-child(4), .ip-table td:nth-child(4) { width: 10% !important; }
        .ip-table th:nth-child(5), .ip-table td:nth-child(5) { width: 8% !important; }
        .ip-table th:nth-child(6), .ip-table td:nth-child(6) { width: 10% !important; }
        .ip-table th:nth-child(7), .ip-table td:nth-child(7) { width: 10% !important; }
        .ip-table th:nth-child(8), .ip-table td:nth-child(8) { width: 14% !important; }
        .ip-table th:nth-child(9), .ip-table td:nth-child(9) { width: 5% !important; }
        .ip-campaign-name {
          color: var(--purple) !important;
          font-size: 10.5px !important;
          font-weight: 950 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .ip-table small {
          display: block !important;
          margin-top: 2px !important;
          color: #64748b !important;
          font-size: 9px !important;
          font-weight: 700 !important;
        }
        .ip-badge {
          display: inline-flex !important;
          align-items: center !important;
          height: 18px !important;
          padding: 0 7px !important;
          border-radius: 4px !important;
          background: #eef2ff !important;
          color: var(--purple) !important;
          font-size: 9px !important;
          font-weight: 900 !important;
        }
        .ip-status.running { background: #dcfce7 !important; color: #047857 !important; }
        .ip-status.scheduled { background: #dbeafe !important; color: #2563eb !important; }
        .ip-status.paused { background: #ffedd5 !important; color: #ea580c !important; }
        .ip-status.draft { background: #f1f5f9 !important; color: #475569 !important; }
        .ip-actions {
          display: flex !important;
          gap: 6px !important;
        }
        .ip-actions button {
          width: 23px !important;
          height: 23px !important;
          min-height: 23px !important;
          padding: 0 !important;
          border: 1px solid #e5e9f4 !important;
          border-radius: 6px !important;
          display: grid !important;
          place-items: center !important;
          background: #fff !important;
          color: var(--purple) !important;
        }
        .ip-todo { height: 365px !important; }
        .ip-schedule { height: 154px !important; }
        .ip-activity { height: 184px !important; }
        .ip-tabs {
          height: 38px !important;
          padding: 0 16px !important;
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          border-bottom: 1px solid #edf1f7 !important;
        }
        .ip-tabs button {
          height: 38px !important;
          min-height: 38px !important;
          padding: 0 !important;
          border: 0 !important;
          border-bottom: 2px solid transparent !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #475569 !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }
        .ip-tabs button.active {
          color: var(--purple) !important;
          border-color: var(--purple) !important;
        }
        .ip-todo-stats {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 10px !important;
          padding: 13px 16px 10px !important;
        }
        .ip-todo-stats span {
          height: 48px !important;
          border: 1px solid #e5e9f4 !important;
          border-radius: 8px !important;
          display: grid !important;
          place-items: center !important;
          color: #64748b !important;
          font-size: 9px !important;
          font-weight: 800 !important;
        }
        .ip-todo-stats strong {
          font-size: 16px !important;
          color: var(--purple) !important;
        }
        .ip-todo-title {
          padding: 0 16px 8px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          color: var(--ink) !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }
        .ip-todo-title button {
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: var(--purple) !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }
        .ip-todo-list,
        .ip-schedule-list,
        .ip-activity-list {
          display: grid !important;
          gap: 8px !important;
          padding: 0 16px 13px !important;
        }
        .ip-todo-item,
        .ip-schedule-item,
        .ip-activity-item {
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 3px 0 !important;
          text-align: left !important;
        }
        .ip-todo-item {
          display: grid !important;
          grid-template-columns: 16px 1fr auto !important;
          gap: 10px !important;
          align-items: start !important;
        }
        .ip-timeline-dot {
          width: 10px !important;
          height: 10px !important;
          margin-top: 3px !important;
          border-radius: 50% !important;
          background: var(--purple) !important;
          box-shadow: 0 0 0 4px #eef2ff !important;
        }
        .ip-todo-item strong,
        .ip-schedule-item strong,
        .ip-activity-item strong {
          color: var(--ink) !important;
          font-size: 10.5px !important;
          font-weight: 950 !important;
          line-height: 1.12 !important;
        }
        .ip-todo-item small {
          grid-column: 2 !important;
        }
        .ip-todo-item small,
        .ip-schedule-item small,
        .ip-activity-item small {
          color: #64748b !important;
          font-size: 9px !important;
          font-weight: 700 !important;
        }
        .ip-priority {
          grid-column: 3 !important;
          grid-row: 1 / span 2 !important;
          padding: 4px 8px !important;
          border-radius: 999px !important;
          background: #fee2e2 !important;
          color: #ef4444 !important;
          font-size: 9px !important;
          font-style: normal !important;
          font-weight: 900 !important;
        }
        .ip-priority.medium { background: #fff2d9 !important; color: #f59e0b !important; }
        .ip-priority.low { background: #dcfce7 !important; color: #10b981 !important; }
        .ip-schedule-list { padding-top: 5px !important; }
        .ip-schedule-item {
          display: grid !important;
          grid-template-columns: 58px 24px 1fr !important;
          gap: 9px !important;
          align-items: start !important;
        }
        .ip-schedule-item time,
        .ip-activity-item time {
          color: var(--ink) !important;
          font-size: 10px !important;
          line-height: 1.05 !important;
          font-weight: 900 !important;
        }
        .ip-schedule-item time small,
        .ip-activity-item time small {
          display: block !important;
          margin-top: 3px !important;
          color: #64748b !important;
          font-size: 8px !important;
          font-weight: 700 !important;
        }
        .ip-schedule-icon,
        .ip-activity-icon {
          width: 24px !important;
          height: 24px !important;
          border-radius: 50% !important;
          display: grid !important;
          place-items: center !important;
          background: var(--purple) !important;
          color: #fff !important;
          font-size: 13px !important;
        }
        .ip-activity-item {
          display: grid !important;
          grid-template-columns: 46px 22px 1fr !important;
          gap: 8px !important;
          align-items: start !important;
        }
        .ip-activity-icon {
          width: 22px !important;
          height: 22px !important;
          font-size: 12px !important;
        }
        .ip-activity-icon.green { background: #dcfce7 !important; color: #16a34a !important; }
        .ip-activity-icon.blue { background: #dbeafe !important; color: #2563eb !important; }
        .ip-activity-icon.red { background: #fee2e2 !important; color: #ef4444 !important; }
        .ip-activity-icon.slate { background: #f1f5f9 !important; color: #64748b !important; }
        .ip-tip {
          height: 28px !important;
          padding: 0 16px !important;
          border-radius: 7px !important;
          display: flex !important;
          align-items: center !important;
          gap: 7px !important;
          background: #f2efff !important;
          color: #273657 !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }
        .ip-footer {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          color: #64748b !important;
          font-size: 10px !important;
          font-weight: 700 !important;
        }
        .ip-footer nav {
          display: flex !important;
          gap: 22px !important;
        }
        .ip-footer a {
          color: #334155 !important;
          text-decoration: none !important;
        }
        .ip-collapse {
          margin-top: auto !important;
          height: 48px !important;
          border-top: 1px solid #e8ecf5 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 0 23px !important;
          color: #4b5878 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }
        @media (min-width: 1600px) {
          .ip-content {
            max-width: 1320px !important;
          }
          .ip-grid {
            grid-template-columns: minmax(0, 1fr) 400px !important;
          }
        }
        @media (max-width: 1400px) {
          .ip-top-control.date { margin-left: 0 !important; }
          .ip-top-control { min-width: 165px !important; }
          .ip-top-control.sender { min-width: 220px !important; }
          .ip-top-control.date { min-width: 205px !important; }
          .ip-grid { grid-template-columns: minmax(0, 1fr) 350px !important; }
          .ip-content { padding-left: 18px !important; padding-right: 18px !important; }
          .ip-stat { grid-template-columns: 42px minmax(0, 1fr) !important; padding: 15px 12px !important; }
          .ip-stat-icon { width: 42px !important; height: 42px !important; font-size: 20px !important; }
          .ip-stat strong { font-size: 18px !important; }
        }
        @media (max-width: 1260px) {
          .ip-exact-topbar {
            gap: 10px !important;
          }
          .ip-top-control { min-width: 150px !important; }
          .ip-top-control.sender { min-width: 205px !important; }
          .ip-top-control.date { min-width: 190px !important; }
          .ip-user { width: 120px !important; grid-template-columns: 34px minmax(0, 1fr) !important; }
          .ip-create { padding: 0 13px !important; }
          .ip-create span { display: none !important; }
          .ip-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 1180px) {
          .ip-exact-shell { grid-template-columns: 72px minmax(0, 1fr) !important; }
          .ip-exact-sidebar { overflow-x: hidden !important; }
          .ip-exact-logo-copy,
          .ip-exact-search span,
          .ip-exact-nav-label,
          .ip-exact-nav-link span,
          .ip-collapse span { display: none !important; }
          .ip-exact-nav-link { justify-content: center !important; padding: 0 !important; }
          .ip-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .ip-grid { grid-template-columns: 1fr !important; }
          .ip-chart-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
          .ip-exact-topbar { flex-wrap: wrap !important; height: auto !important; min-height: 64px !important; padding: 10px 16px !important; }
          .ip-top-control.date { margin-left: 0 !important; }
          .ip-right { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .ip-todo { grid-column: 1 / -1 !important; }
          .ip-schedule,
          .ip-activity { height: auto !important; min-height: 184px !important; }
          .ip-table { min-width: 860px !important; }
        }
        @media (max-width: 980px) {
          .ip-exact-topbar {
            align-items: stretch !important;
          }
          .ip-top-control {
            flex: 1 1 calc(50% - 8px) !important;
            min-width: 220px !important;
          }
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 220px !important;
          }
          .ip-top-toggle,
          .ip-bell {
            flex: 0 0 auto !important;
          }
          .ip-user {
            flex: 1 1 180px !important;
            width: auto !important;
          }
          .ip-create {
            flex: 0 0 auto !important;
          }
          .ip-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .ip-workflow { height: auto !important; min-height: 154px !important; overflow-x: auto !important; }
          .ip-steps { min-width: 720px !important; }
          .ip-line,
          .ip-donut-card { height: auto !important; min-height: 231px !important; }
          .ip-donut-layout { grid-template-columns: 130px 1fr !important; }
          .ip-right { grid-template-columns: 1fr !important; }
          .ip-todo,
          .ip-schedule,
          .ip-activity { height: auto !important; min-height: 0 !important; }
          .ip-footer { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
        }
        @media (max-width: 760px) {
          .ip-exact-shell { grid-template-columns: 1fr !important; }
          .ip-exact-sidebar { display: none !important; }
          .ip-exact-topbar {
            padding: 12px !important;
            gap: 8px !important;
          }
          .ip-content { padding: 12px !important; gap: 12px !important; }
          .ip-welcome { height: auto !important; }
          .ip-welcome h1 { font-size: 20px !important; }
          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            flex: 1 1 100% !important;
            min-width: 0 !important;
            width: 100% !important;
          }
          .ip-top-toggle { order: 4 !important; }
          .ip-bell { order: 5 !important; }
          .ip-user { order: 6 !important; flex: 1 1 calc(100% - 130px) !important; }
          .ip-create { order: 7 !important; flex: 1 1 100% !important; justify-content: center !important; }
          .ip-create span { display: inline !important; }
          .ip-stats { grid-template-columns: 1fr !important; }
          .ip-stat { height: auto !important; min-height: 96px !important; }
          .ip-workflow { overflow-x: auto !important; }
          .ip-steps { min-width: 720px !important; }
          .ip-card-head { align-items: flex-start !important; padding-top: 12px !important; padding-bottom: 10px !important; min-height: 0 !important; }
          .ip-donut-layout { grid-template-columns: 1fr !important; justify-items: center !important; }
          .ip-legend { width: 100% !important; }
          .ip-table { min-width: 780px !important; }
          .ip-todo-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .ip-schedule-item { grid-template-columns: 58px 24px minmax(0, 1fr) !important; }
          .ip-activity-item { grid-template-columns: 44px 22px minmax(0, 1fr) !important; }
          .ip-tip { height: auto !important; min-height: 36px !important; padding: 8px 12px !important; align-items: flex-start !important; }
          .ip-footer nav { flex-wrap: wrap !important; gap: 10px !important; }
        }
        @media (max-width: 420px) {
          .ip-content { padding: 10px !important; }
          .ip-stat { grid-template-columns: 40px minmax(0, 1fr) !important; padding: 14px 12px !important; }
          .ip-stat-icon { width: 40px !important; height: 40px !important; font-size: 19px !important; }
          .ip-stat strong { font-size: 19px !important; }
          .ip-tabs { padding: 0 10px !important; }
          .ip-tabs button { font-size: 9px !important; }
          .ip-todo-stats { padding-left: 10px !important; padding-right: 10px !important; gap: 8px !important; }
          .ip-todo-list,
          .ip-schedule-list,
          .ip-activity-list { padding-left: 10px !important; padding-right: 10px !important; }
        }

        /* Responsive hardening layer: fluid first, fixed only where the reference needs it. */
        .ip-exact-shell {
          max-width: 100vw !important;
        }

        .ip-exact-main,
        .ip-content,
        .ip-grid,
        .ip-left,
        .ip-right,
        .ip-card,
        .ip-table-card,
        .ip-table-wrap {
          min-width: 0 !important;
        }

        .ip-exact-topbar {
          max-width: 100% !important;
        }

        .ip-top-control,
        .ip-user,
        .ip-create {
          flex-shrink: 1 !important;
        }

        .ip-card {
          contain: layout paint !important;
        }

        .ip-line-body svg {
          min-width: 0 !important;
        }

        @media (max-width: 1536px) and (min-width: 1281px) {
          .ip-content {
            max-width: none !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
          }

          .ip-grid {
            grid-template-columns: minmax(0, 1fr) minmax(330px, 390px) !important;
          }

          .ip-stat {
            min-width: 0 !important;
          }
        }

        @media (max-width: 1280px) and (min-width: 1025px) {
          .ip-exact-shell {
            grid-template-columns: 84px minmax(0, 1fr) !important;
          }

          .ip-exact-logo {
            justify-content: center !important;
            padding: 0 !important;
          }

          .ip-exact-logo-copy,
          .ip-exact-search span,
          .ip-exact-nav-label,
          .ip-exact-nav-link span,
          .ip-collapse span {
            display: none !important;
          }

          .ip-exact-search {
            width: 44px !important;
            margin-left: auto !important;
            margin-right: auto !important;
            justify-content: center !important;
            padding: 0 !important;
          }

          .ip-exact-nav-link {
            justify-content: center !important;
            margin-left: 14px !important;
            margin-right: 14px !important;
            padding: 0 !important;
          }

          .ip-collapse {
            justify-content: center !important;
            padding: 0 !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: minmax(150px, 1fr) minmax(210px, 1.4fr) minmax(190px, 1.1fr) auto auto minmax(120px, auto) auto !important;
            gap: 10px !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
          }

          .ip-user {
            width: 120px !important;
          }

          .ip-grid {
            grid-template-columns: minmax(0, 1fr) 330px !important;
          }
        }

        @media (max-width: 1024px) {
          .ip-exact-shell {
            grid-template-columns: 1fr !important;
          }

          .ip-exact-sidebar {
            display: none !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto !important;
            height: auto !important;
            min-height: 64px !important;
            padding: 12px !important;
            gap: 10px !important;
            align-items: stretch !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .ip-user {
            width: auto !important;
            min-width: 0 !important;
          }

          .ip-create {
            min-width: 0 !important;
            justify-content: center !important;
          }

          .ip-content {
            max-width: none !important;
            padding: 14px !important;
          }

          .ip-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ip-grid { grid-template-columns: 1fr !important; }
          .ip-chart-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }

          .ip-right {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ip-todo {
            grid-column: 1 / -1 !important;
          }

          .ip-workflow,
          .ip-line,
          .ip-donut-card,
          .ip-todo,
          .ip-schedule,
          .ip-activity,
          .ip-table-card {
            height: auto !important;
            min-height: 0 !important;
          }
        }

        @media (max-width: 640px) {
          .ip-exact-topbar {
            grid-template-columns: 1fr 1fr !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date,
          .ip-create {
            grid-column: 1 / -1 !important;
          }

          .ip-top-toggle,
          .ip-bell {
            justify-self: start !important;
          }

          .ip-user {
            grid-column: 1 / -1 !important;
          }

          .ip-stats,
          .ip-right {
            grid-template-columns: 1fr !important;
          }

          .ip-stat {
            min-height: 92px !important;
          }

          .ip-card-head {
            flex-wrap: wrap !important;
            row-gap: 8px !important;
          }

          .ip-donut-layout {
            grid-template-columns: 1fr !important;
            justify-items: center !important;
            text-align: left !important;
          }

          .ip-legend {
            width: 100% !important;
          }

          .ip-table {
            min-width: 760px !important;
          }

          .ip-footer {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
        }

        /* Final reference breakpoints: full desktop sidebar, clean responsive stacking. */
        html,
        body {
          width: 100% !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
        }

        body main.dashboard-shell.dashboard-exact-only {
          width: 100% !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          background: #ffffff !important;
        }

        .ip-exact-search {
          display: none !important;
        }

        .ip-exact-sidebar {
          display: flex !important;
          flex-direction: column !important;
          overflow-x: hidden !important;
        }

        .ip-exact-logo-copy,
        .ip-exact-nav-label,
        .ip-exact-nav-link span,
        .ip-collapse span {
          display: block !important;
        }

        .ip-exact-nav-link {
          justify-content: flex-start !important;
        }

        .ip-top-control strong,
        .ip-user strong,
        .ip-user small,
        .ip-create span,
        .ip-legend-row span,
        .ip-legend-row strong {
          white-space: nowrap !important;
        }

        .ip-legend-row {
          grid-template-columns: auto minmax(72px, 1fr) auto !important;
        }

        .ip-table th:nth-child(9),
        .ip-table td:nth-child(9) {
          width: 72px !important;
          min-width: 72px !important;
          max-width: 72px !important;
        }

        @media (min-width: 1400px) {
          .ip-exact-shell {
            grid-template-columns: 236px minmax(0, 1fr) !important;
          }

          .ip-exact-sidebar {
            width: 236px !important;
            min-width: 236px !important;
          }

          .ip-exact-logo {
            justify-content: flex-start !important;
            padding: 0 20px !important;
          }

          .ip-exact-nav-label {
            margin: 16px 24px 8px !important;
          }

          .ip-exact-nav-link {
            margin-left: 14px !important;
            margin-right: 14px !important;
            padding: 0 13px !important;
          }

          .ip-content {
            max-width: none !important;
            padding: 14px 24px 14px !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: 226px 300px minmax(226px, 1fr) 64px 34px 158px 178px !important;
            height: 64px !important;
            padding: 0 24px !important;
            gap: 14px !important;
            align-items: center !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .ip-create {
            width: 178px !important;
            justify-content: center !important;
          }

          .ip-stats {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }

          .ip-grid {
            grid-template-columns: minmax(0, 1fr) 390px !important;
            gap: 16px !important;
          }

          .ip-chart-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }
        }

        @media (min-width: 1200px) and (max-width: 1399px) {
          .ip-exact-shell {
            grid-template-columns: 236px minmax(0, 1fr) !important;
          }

          .ip-exact-sidebar {
            width: 236px !important;
            min-width: 236px !important;
          }

          .ip-exact-logo {
            justify-content: flex-start !important;
            padding: 0 20px !important;
          }

          .ip-exact-nav-link {
            justify-content: flex-start !important;
            margin-left: 14px !important;
            margin-right: 14px !important;
            padding: 0 13px !important;
          }

          .ip-content {
            max-width: none !important;
            padding: 14px 18px 14px !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.35fr) minmax(190px, 1fr) 64px 34px 130px 150px !important;
            height: 64px !important;
            padding: 0 18px !important;
            gap: 10px !important;
            align-items: center !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .ip-user {
            width: 130px !important;
          }

          .ip-create {
            width: 150px !important;
            padding: 0 12px !important;
            justify-content: center !important;
          }

          .ip-create span {
            display: inline !important;
          }

          .ip-stats {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }

          .ip-stat {
            grid-template-columns: 38px minmax(0, 1fr) !important;
            padding: 13px 10px !important;
          }

          .ip-stat-icon {
            width: 38px !important;
            height: 38px !important;
            font-size: 18px !important;
          }

          .ip-stat strong {
            font-size: 17px !important;
          }

          .ip-stat small {
            font-size: 9px !important;
          }

          .ip-grid {
            grid-template-columns: minmax(0, 1fr) 360px !important;
            gap: 16px !important;
          }

          .ip-chart-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }

          .ip-table {
            min-width: 820px !important;
          }
        }

        @media (min-width: 1024px) and (max-width: 1199px) {
          .ip-exact-shell {
            grid-template-columns: 220px minmax(0, 1fr) !important;
          }

          .ip-exact-sidebar {
            display: flex !important;
            width: 220px !important;
            min-width: 220px !important;
          }

          .ip-exact-logo {
            justify-content: flex-start !important;
            padding: 0 18px !important;
          }

          .ip-exact-logo-copy,
          .ip-exact-nav-label,
          .ip-exact-nav-link span,
          .ip-collapse span {
            display: block !important;
          }

          .ip-exact-nav-link {
            justify-content: flex-start !important;
            margin-left: 12px !important;
            margin-right: 12px !important;
            padding: 0 12px !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) auto auto minmax(130px, auto) 150px !important;
            height: auto !important;
            min-height: 64px !important;
            padding: 10px 16px !important;
            gap: 10px !important;
            align-items: center !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .ip-create {
            justify-content: center !important;
          }

          .ip-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          .ip-grid { grid-template-columns: 1fr !important; }
          .ip-chart-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }

          .ip-right {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ip-todo {
            grid-column: 1 / -1 !important;
          }
        }

        @media (max-width: 1023px) {
          .ip-exact-shell {
            grid-template-columns: 1fr !important;
          }

          .ip-exact-sidebar {
            display: none !important;
          }

          .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto !important;
            height: auto !important;
            min-height: 64px !important;
            padding: 12px !important;
            gap: 10px !important;
            align-items: stretch !important;
          }

          .ip-top-control,
          .ip-top-control.sender,
          .ip-top-control.date {
            min-width: 0 !important;
            width: 100% !important;
            margin-left: 0 !important;
          }

          .ip-user {
            width: auto !important;
          }

          .ip-create {
            justify-content: center !important;
          }

          .ip-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ip-grid { grid-template-columns: 1fr !important; }
          .ip-chart-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }

          .ip-right {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .ip-todo {
            grid-column: 1 / -1 !important;
          }
        }

        @media (max-width: 767px) {
          .ip-exact-topbar {
            grid-template-columns: 1fr !important;
          }

          .ip-top-toggle,
          .ip-bell {
            justify-self: start !important;
          }

          .ip-stats,
          .ip-right {
            grid-template-columns: 1fr !important;
          }

          .ip-workflow {
            overflow-x: auto !important;
          }

          .ip-steps {
            min-width: 720px !important;
          }

          .ip-table {
            min-width: 780px !important;
          }
        }
        /* Last-mile responsive overrides. These intentionally come last because
           the reference stylesheet above repeats some desktop widths. */
        html body main.dashboard-shell.dashboard-exact-only,
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-shell,
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-main,
        html body main.dashboard-shell.dashboard-exact-only .ip-content {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-exact-shell {
          overflow-x: clip !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-exact-main,
        html body main.dashboard-shell.dashboard-exact-only .ip-content,
        html body main.dashboard-shell.dashboard-exact-only .ip-card,
        html body main.dashboard-shell.dashboard-exact-only .ip-stats,
        html body main.dashboard-shell.dashboard-exact-only .ip-grid,
        html body main.dashboard-shell.dashboard-exact-only .ip-chart-row,
        html body main.dashboard-shell.dashboard-exact-only .ip-left,
        html body main.dashboard-shell.dashboard-exact-only .ip-right {
          min-width: 0 !important;
          max-width: 100% !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-top-control,
        html body main.dashboard-shell.dashboard-exact-only .ip-user,
        html body main.dashboard-shell.dashboard-exact-only .ip-create {
          min-width: 0 !important;
          max-width: 100% !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-top-control strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-user strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-user small,
        html body main.dashboard-shell.dashboard-exact-only .ip-stat label,
        html body main.dashboard-shell.dashboard-exact-only .ip-stat strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-stat small,
        html body main.dashboard-shell.dashboard-exact-only .ip-card-head h3,
        html body main.dashboard-shell.dashboard-exact-only .ip-card-head p,
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-item strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item small,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item small {
          overflow-wrap: anywhere !important;
        }

        @media (min-width: 1200px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-shell {
            grid-template-columns: clamp(220px, 16vw, 236px) minmax(0, 1fr) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-sidebar {
            width: auto !important;
            min-width: 0 !important;
            display: flex !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: minmax(145px, 1fr) minmax(190px, 1.35fr) minmax(170px, 1fr) 64px 34px minmax(116px, 150px) minmax(138px, 178px) !important;
          }
        }

        @media (min-width: 1024px) and (max-width: 1199px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-shell {
            grid-template-columns: 88px minmax(0, 1fr) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-sidebar {
            display: flex !important;
            width: 88px !important;
            min-width: 88px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-logo {
            justify-content: center !important;
            padding: 0 !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-logo-copy,
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-nav-label,
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-nav-link span,
          html body main.dashboard-shell.dashboard-exact-only .ip-collapse span {
            display: none !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-nav-link {
            justify-content: center !important;
            margin-left: 18px !important;
            margin-right: 18px !important;
            padding: 0 !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) auto auto minmax(120px, 140px) minmax(132px, 150px) !important;
            height: auto !important;
            min-height: 64px !important;
            padding: 10px 14px !important;
            gap: 10px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-grid {
            grid-template-columns: 1fr !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-chart-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-right {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-todo {
            grid-column: 1 / -1 !important;
          }
        }

        @media (max-width: 1023px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-shell {
            display: block !important;
            grid-template-columns: 1fr !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-sidebar {
            display: none !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-main {
            display: block !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 12px !important;
            gap: 10px !important;
            align-items: stretch !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-top-control,
          html body main.dashboard-shell.dashboard-exact-only .ip-top-control.sender,
          html body main.dashboard-shell.dashboard-exact-only .ip-top-control.date {
            width: 100% !important;
            min-width: 0 !important;
            margin-left: 0 !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-user {
            width: auto !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-create {
            justify-content: center !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-content {
            max-width: none !important;
            padding: 14px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-grid {
            grid-template-columns: 1fr !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-chart-row {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-right {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-todo {
            grid-column: 1 / -1 !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-workflow,
          html body main.dashboard-shell.dashboard-exact-only .ip-line,
          html body main.dashboard-shell.dashboard-exact-only .ip-donut-card,
          html body main.dashboard-shell.dashboard-exact-only .ip-todo,
          html body main.dashboard-shell.dashboard-exact-only .ip-schedule,
          html body main.dashboard-shell.dashboard-exact-only .ip-activity,
          html body main.dashboard-shell.dashboard-exact-only .ip-table-card {
            height: auto !important;
            min-height: 0 !important;
          }
        }

        @media (max-width: 767px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-chart-row {
            grid-template-columns: 1fr !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            grid-template-columns: 1fr !important;
            padding: 10px !important;
            gap: 8px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-top-control,
          html body main.dashboard-shell.dashboard-exact-only .ip-top-control.sender,
          html body main.dashboard-shell.dashboard-exact-only .ip-top-control.date,
          html body main.dashboard-shell.dashboard-exact-only .ip-user,
          html body main.dashboard-shell.dashboard-exact-only .ip-create {
            grid-column: 1 / -1 !important;
            width: 100% !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-top-toggle,
          html body main.dashboard-shell.dashboard-exact-only .ip-bell {
            justify-self: start !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-content {
            padding: 10px !important;
            gap: 12px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-welcome {
            height: auto !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stats,
          html body main.dashboard-shell.dashboard-exact-only .ip-right {
            grid-template-columns: 1fr !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stat {
            width: 100% !important;
            height: auto !important;
            min-height: 92px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-card-head {
            flex-wrap: wrap !important;
            align-items: flex-start !important;
            min-height: 0 !important;
            padding-top: 12px !important;
            padding-bottom: 10px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-workflow,
          html body main.dashboard-shell.dashboard-exact-only .ip-table-wrap {
            overflow-x: auto !important;
            overflow-y: hidden !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-steps {
            min-width: 680px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-donut-layout {
            grid-template-columns: 1fr !important;
            justify-items: center !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-table {
            min-width: 760px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-footer {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-footer nav {
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 420px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-content,
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stat {
            grid-template-columns: 40px minmax(0, 1fr) !important;
            padding: 14px 12px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-stat-icon {
            width: 40px !important;
            height: 40px !important;
            font-size: 19px !important;
          }

          html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
            height: auto !important;
            min-height: 42px !important;
          }
        }
        /* Final finishing pass: widget polish and desktop/tablet/mobile fit. */
        html body main.dashboard-shell.dashboard-exact-only .ip-content {
          padding-top: clamp(14px, 1.2vw, 22px) !important;
          padding-bottom: 18px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          box-shadow: 0 1px 0 rgba(226, 232, 240, .75) !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
          overflow: hidden !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-top-control strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-user strong {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-stats {
          align-items: stretch !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-stat {
          min-width: 0 !important;
          overflow: hidden !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-stat > div {
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-stat small {
          overflow-wrap: normal !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-card {
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-workflow {
          min-height: 164px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-card-head button,
        html body main.dashboard-shell.dashboard-exact-only .ip-step-action,
        html body main.dashboard-shell.dashboard-exact-only .ip-tabs button,
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-title button {
          white-space: nowrap !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-donut-card {
          overflow: hidden !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-donut-layout {
          grid-template-columns: minmax(108px, 128px) minmax(0, 1fr) !important;
          gap: 18px !important;
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-donut {
          width: 125px !important;
          height: 125px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-donut::after {
          inset: 33px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-legend {
          min-width: 0 !important;
          gap: 11px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-legend-row {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          min-width: 0 !important;
          gap: 9px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-legend-row span:not(.ip-dot) {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-legend-row strong {
          min-width: max-content !important;
          white-space: nowrap !important;
          font-size: 10px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-table-card {
          min-height: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-table-wrap {
          overflow-x: auto !important;
          overflow-y: hidden !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-table {
          table-layout: fixed !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-table th,
        html body main.dashboard-shell.dashboard-exact-only .ip-table td {
          min-width: 0 !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(1),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(1) { width: 26% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(2),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(2) { width: 9% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(3),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(3) { width: 11% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(4),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(4) { width: 10% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(5),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(5) { width: 8% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(6),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(6) { width: 11% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(7),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(7) { width: 11% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(8),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(8) { width: 14% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(9),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(9) {
          width: 58px !important;
          min-width: 58px !important;
          max-width: 58px !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-right {
          align-content: start !important;
        }

        html body main.dashboard-shell.dashboard-exact-only .ip-todo,
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule,
        /* Keep exact schedule rows inside the card. */
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule {
          height: 220px !important;
          min-height: 220px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list {
          padding: 8px 16px 14px !important;
          gap: 9px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item {
          grid-template-columns: 64px 24px minmax(0, 1fr) !important;
          gap: 10px !important;
          padding: 5px 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item strong {
          font-size: 11px !important;
          line-height: 1.15 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item small {
          font-size: 9px !important;
          line-height: 1.25 !important;
        }
        /* Keep exact activity rows inside the card. */
        html body main.dashboard-shell.dashboard-exact-only .ip-activity {
          height: 260px !important;
          min-height: 260px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list {
          padding: 8px 16px 14px !important;
          gap: 9px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item {
          grid-template-columns: 64px 24px minmax(0, 1fr) !important;
          gap: 10px !important;
          padding: 5px 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item strong {
          font-size: 11px !important;
          line-height: 1.15 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item small {
          font-size: 9px !important;
          line-height: 1.25 !important;
        }
        /* Keep exact todo rows inside the card. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo {
          height: 390px !important;
          min-height: 390px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-stats {
          padding: 10px 16px !important;
          gap: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-stats span {
          min-height: 48px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-title {
          padding: 8px 16px 6px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          padding: 6px 16px 8px !important;
          gap: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-item {
          padding: 6px 0 !important;
          row-gap: 3px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-item strong {
          line-height: 1.2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-item small {
          line-height: 1.25 !important;
        }
        /* Reduce exact todo header-to-tabs spacing. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-card-head {
          min-height: 42px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-tabs {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-tabs button {
          height: 32px !important;
        }
        /* Show exact todo timeline rail and dots. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          position: relative !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list::before {
          content: "";
          position: absolute;
          left: 22px;
          top: 17px;
          bottom: 17px;
          width: 2px;
          background: #dbe3f0;
          border-radius: 999px;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-item {
          position: relative !important;
          z-index: 1;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-timeline-dot {
          grid-column: 1 !important;
          grid-row: 1 / span 2 !important;
          width: 12px !important;
          height: 12px !important;
          margin-top: 3px !important;
          border: 2px solid #ffffff !important;
          border-radius: 50% !important;
          background: #4f46e5 !important;
          box-shadow: 0 0 0 3px #eef2ff !important;
        }
        /* Show exact schedule timeline rail and markers. */
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list {
          position: relative !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list::before {
          content: "";
          position: absolute;
          left: 102px;
          top: 25px;
          bottom: 25px;
          width: 2px;
          background: #dbe3f0;
          border-radius: 999px;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item {
          position: relative !important;
          z-index: 1;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-icon {
          width: 24px !important;
          height: 24px !important;
          display: grid !important;
          place-items: center !important;
          border: 2px solid #ffffff !important;
          border-radius: 50% !important;
          background: #4f46e5 !important;
          color: #ffffff !important;
          box-shadow: 0 0 0 3px #eef2ff !important;
        }
        /* Show exact activity timeline rail and markers. */
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list {
          position: relative !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list::before {
          content: "";
          position: absolute;
          left: 102px;
          top: 25px;
          bottom: 25px;
          width: 2px;
          background: #dbe3f0;
          border-radius: 999px;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item {
          position: relative !important;
          z-index: 1;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-icon {
          width: 24px !important;
          height: 24px !important;
          display: grid !important;
          place-items: center !important;
          border: 2px solid #ffffff !important;
          border-radius: 50% !important;
          box-shadow: 0 0 0 3px #eef2ff !important;
        }
        /* Show seven exact recent campaign rows. */
        html body main.dashboard-shell.dashboard-exact-only .ip-table-card {
          min-height: 350px !important;
        }
        /* Pin exact recent campaigns scrollbar to section bottom. */
        html body main.dashboard-shell.dashboard-exact-only .ip-table-card {
          display: flex !important;
          flex-direction: column !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table-card .ip-table-wrap {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
        }
        /* Add exact recent campaign serial number column widths. */
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(1),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(1) {
          width: 5% !important;
          text-align: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(2),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(2) { width: 24% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(3),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(3) { width: 7% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(4),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(4) { width: 9% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(5),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(5) { width: 9% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(6),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(6) { width: 7% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(7),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(7) { width: 9% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(8),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(8) { width: 9% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(9),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(9) { width: 16% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-table th:nth-child(10),
        html body main.dashboard-shell.dashboard-exact-only .ip-table td:nth-child(10) { width: 5% !important; }
        html body main.dashboard-shell.dashboard-exact-only .ip-sr-no {
          color: #64748b !important;
          font-weight: 900 !important;
        }
        /* Exact persistent topbar hamburger before controls. */
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu {
          flex: 0 0 38px !important;
          width: 38px !important;
          height: 38px !important;
          min-width: 38px !important;
          min-height: 38px !important;
          padding: 0 !important;
          border: 1px solid #e3e8f4 !important;
          border-radius: 8px !important;
          display: inline-grid !important;
          place-items: center !important;
          background: #ffffff !important;
          color: #4f46e5 !important;
          font-size: 20px !important;
          cursor: pointer !important;
          box-shadow: none !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu:hover {
          background: #f5f3ff !important;
          border-color: #c7d2fe !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          align-items: center !important;
        }
        /* Tighten exact topbar hamburger project gap. */
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          column-gap: 6px !important;
          row-gap: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu {
          margin-right: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu + .ip-top-control {
          margin-left: 0 !important;
        }
        /* Compact exact topbar hamburger row layout. */
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          display: flex !important;
          flex-wrap: nowrap !important;
          justify-content: flex-start !important;
          align-items: center !important;
          gap: 8px !important;
          grid-template-columns: none !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu {
          flex: 0 0 38px !important;
          margin-right: 0 !important;
          order: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu + .ip-top-control {
          margin-left: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
          flex: 0 1 194px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.sender {
          flex-basis: 256px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.date {
          flex-basis: 220px !important;
          margin-left: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-toggle,
        html body main.dashboard-shell.dashboard-exact-only .ip-bell,
        html body main.dashboard-shell.dashboard-exact-only .ip-user,
        html body main.dashboard-shell.dashboard-exact-only .ip-create {
          flex-shrink: 0 !important;
        }
        /* Exact topbar final visual alignment cleanup. */
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          padding-left: 26px !important;
          padding-right: 26px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
          flex: 0 1 232px !important;
          min-width: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.sender {
          flex: 0 1 306px !important;
          min-width: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.date {
          flex: 0 1 264px !important;
          min-width: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user {
          width: 188px !important;
          min-width: 188px !important;
          grid-template-columns: 40px minmax(0, 1fr) !important;
          column-gap: 10px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user-avatar {
          width: 40px !important;
          height: 40px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user strong,
        html body main.dashboard-shell.dashboard-exact-only .ip-user small {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-create {
          min-width: 190px !important;
          justify-content: center !important;
        }
        /* Keep exact profile as final topbar item. */
        html body main.dashboard-shell.dashboard-exact-only .ip-create {
          order: 20 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user {
          order: 30 !important;
          margin-left: 0 !important;
        }
        /* Pin exact profile to far right end of topbar. */
        html body main.dashboard-shell.dashboard-exact-only .ip-top-toggle {
          margin-left: auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-toggle,
        html body main.dashboard-shell.dashboard-exact-only .ip-bell,
        html body main.dashboard-shell.dashboard-exact-only .ip-create,
        html body main.dashboard-shell.dashboard-exact-only .ip-user {
          flex: 0 0 auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user {
          margin-left: 4px !important;
        }
        /* Live exact dashboard controls. */
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control select {
          grid-column: 2 / 4 !important;
          width: 100% !important;
          min-width: 0 !important;
          border: 0 !important;
          outline: 0 !important;
          background: transparent !important;
          color: var(--ink) !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          line-height: 1.15 !important;
          padding: 0 !important;
          appearance: none !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item {
          display: grid !important;
          grid-template-columns: 18px minmax(0, 1fr) auto !important;
          grid-template-rows: auto auto !important;
          column-gap: 8px !important;
          row-gap: 2px !important;
          width: 100% !important;
          border: 0 !important;
          background: transparent !important;
          text-align: left !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-complete {
          grid-row: 1 / 3 !important;
          width: 18px !important;
          height: 18px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          display: grid !important;
          place-items: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-actions {
          grid-column: 3 !important;
          grid-row: 1 / 3 !important;
          display: inline-flex !important;
          gap: 4px !important;
          align-items: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-actions button {
          width: 22px !important;
          height: 22px !important;
          padding: 0 !important;
          border: 1px solid #e4e9f4 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          color: #4f46e5 !important;
          display: grid !important;
          place-items: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-empty-cell {
          padding: 18px !important;
          text-align: center !important;
          color: #64748b !important;
          font-weight: 800 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-empty-text {
          margin: 0 !important;
          padding: 8px 10px !important;
          color: #64748b !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }        /* Exact topbar space utilization final pass. */
        html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
          min-width: 0 !important;
          flex-wrap: nowrap !important;
          justify-content: flex-start !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-topbar-menu {
          flex: 0 0 38px !important;
          width: 38px !important;
          min-width: 38px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
          flex: 1 1 0 !important;
          min-width: 150px !important;
          max-width: none !important;
          width: auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.sender {
          flex-grow: 1.45 !important;
          min-width: 190px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-control.date {
          flex-grow: 1.15 !important;
          min-width: 170px !important;
          margin-left: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-top-toggle {
          flex: 0 0 64px !important;
          width: 64px !important;
          min-width: 64px !important;
          margin-left: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-bell {
          flex: 0 0 38px !important;
          width: 38px !important;
          min-width: 38px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-create {
          flex: 0 0 176px !important;
          width: 176px !important;
          min-width: 176px !important;
          justify-content: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-user {
          order: 30 !important;
          flex: 0 0 180px !important;
          width: 180px !important;
          min-width: 180px !important;
          margin-left: 0 !important;
        }
        @media (max-width: 1180px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-exact-topbar {
            flex-wrap: wrap !important;
            height: auto !important;
            min-height: 64px !important;
          }
          html body main.dashboard-shell.dashboard-exact-only .ip-top-control {
            flex: 1 1 220px !important;
          }
          html body main.dashboard-shell.dashboard-exact-only .ip-user,
          html body main.dashboard-shell.dashboard-exact-only .ip-create {
            flex: 1 1 176px !important;
          }
        }
        /* Final live-data layout repair. */
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow {
          height: 184px !important;
          min-height: 184px !important;
          overflow: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-card-head {
          min-height: 46px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-steps {
          height: 128px !important;
          min-width: 0 !important;
          padding: 4px 18px 12px !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          align-items: start !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-step {
          gap: 8px !important;
          min-width: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-step-circle {
          width: 42px !important;
          height: 42px !important;
          min-height: 42px !important;
          font-size: 18px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-step-line {
          top: 20px !important;
          left: calc(50% + 21px) !important;
          width: calc(100% - 42px) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-step strong {
          max-width: 86px !important;
          min-height: 24px !important;
          text-align: center !important;
          white-space: normal !important;
          overflow: hidden !important;
          line-height: 1.15 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-step-action {
          max-width: 96px !important;
          height: 23px !important;
          padding: 0 9px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        html body main.dashboard-shell.dashboard-exact-only button.ip-campaign-name {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          text-align: left !important;
          color: var(--purple) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table-card {
          height: 430px !important;
          min-height: 430px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table-wrap {
          overflow: auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table {
          min-width: 920px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-table td {
          height: 48px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo {
          height: 410px !important;
          min-height: 410px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          max-height: 184px !important;
          overflow-y: auto !important;
          padding-bottom: 12px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list::before {
          bottom: 12px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule {
          height: 230px !important;
          min-height: 230px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list {
          max-height: 172px !important;
          overflow-y: auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity {
          height: 282px !important;
          min-height: 282px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list {
          max-height: 224px !important;
          overflow-y: auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-right {
          align-self: start !important;
        }
        /* Final right-column live data fit. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item {
          grid-template-columns: 18px minmax(0, 1fr) 54px 54px !important;
          column-gap: 8px !important;
          align-items: center !important;
          padding-right: 2px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-priority {
          grid-column: 3 !important;
          grid-row: 1 / 3 !important;
          justify-self: end !important;
          align-self: center !important;
          max-width: 54px !important;
          padding: 3px 7px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 9px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-actions {
          grid-column: 4 !important;
          grid-row: 1 / 3 !important;
          justify-self: end !important;
          align-self: center !important;
          position: static !important;
          z-index: 2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-actions button {
          width: 24px !important;
          height: 24px !important;
          min-width: 24px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          max-height: 188px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule {
          height: 292px !important;
          min-height: 292px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list {
          max-height: 234px !important;
          overflow-y: auto !important;
          padding-top: 8px !important;
          padding-bottom: 12px !important;
          gap: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item {
          min-height: 62px !important;
          padding: 4px 0 !important;
          align-items: start !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item strong {
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
          line-height: 1.18 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item small {
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item time,
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item time {
          min-width: 64px !important;
          color: #0f172a !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item time small,
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item time small {
          color: #64748b !important;
        }
        /* Final To-Do timeline alignment. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          position: relative !important;
          padding-left: 26px !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list::before {
          content: "" !important;
          position: absolute !important;
          left: 32px !important;
          top: 14px !important;
          bottom: 14px !important;
          width: 2px !important;
          background: #dbe3f0 !important;
          border-radius: 999px !important;
          z-index: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item {
          position: relative !important;
          z-index: 1 !important;
          grid-template-columns: 18px minmax(0, 1fr) 54px 54px !important;
          align-items: center !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-complete {
          position: relative !important;
          z-index: 2 !important;
          justify-self: start !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-timeline-dot {
          width: 12px !important;
          height: 12px !important;
          margin: 0 !important;
          border: 2px solid #ffffff !important;
          background: #4f46e5 !important;
          box-shadow: 0 0 0 3px #eef2ff !important;
        }
        /* Hard-fix To-Do timeline continuity with per-row connectors. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list::before {
          display: none !important;
          content: none !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          padding-left: 18px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item {
          position: relative !important;
          grid-template-columns: 24px minmax(0, 1fr) 54px 54px !important;
          column-gap: 6px !important;
          overflow: visible !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item::before {
          content: "" !important;
          position: absolute !important;
          left: 11px !important;
          top: -12px !important;
          bottom: -12px !important;
          width: 2px !important;
          background: #dbe3f0 !important;
          border-radius: 999px !important;
          z-index: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item:first-of-type::before {
          top: 12px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item:last-of-type::before {
          bottom: calc(100% - 12px) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-complete {
          grid-column: 1 !important;
          grid-row: 1 / 3 !important;
          width: 24px !important;
          height: 24px !important;
          display: grid !important;
          place-items: center !important;
          justify-self: center !important;
          align-self: center !important;
          position: relative !important;
          z-index: 2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-timeline-dot {
          width: 12px !important;
          height: 12px !important;
          margin: 0 !important;
          display: block !important;
          border: 2px solid #ffffff !important;
          border-radius: 999px !important;
          background: #4f46e5 !important;
          box-shadow: 0 0 0 3px #eef2ff !important;
        }
        /* Hard-fix schedule and activity timeline continuity with per-row connectors. */
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list::before {
          display: none !important;
          content: none !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-list {
          position: relative !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item {
          position: relative !important;
          overflow: visible !important;
          z-index: 1 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item::before {
          content: "" !important;
          position: absolute !important;
          left: 75px !important;
          top: -14px !important;
          bottom: -14px !important;
          width: 2px !important;
          background: #dbe3f0 !important;
          border-radius: 999px !important;
          z-index: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item:first-of-type::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item:first-of-type::before {
          top: 12px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item:last-of-type::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item:last-of-type::before {
          bottom: calc(100% - 12px) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-icon,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-icon {
          position: relative !important;
          z-index: 2 !important;
          justify-self: center !important;
          align-self: start !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item time,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item time {
          position: relative !important;
          z-index: 2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item .ip-item-copy,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item .ip-item-copy {
          position: relative !important;
          z-index: 2 !important;
          min-width: 0 !important;
        }
        /* Pixel-align schedule/activity rails to icon centers. */
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item {
          grid-template-columns: 64px 24px minmax(0, 1fr) !important;
          column-gap: 10px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item::before {
          left: 85px !important;
          top: -18px !important;
          bottom: -18px !important;
          width: 2px !important;
          background: #dbe3f0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item:first-of-type::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item:first-of-type::before {
          top: 12px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item:last-of-type::before,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-item:last-of-type::before {
          bottom: calc(100% - 12px) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-icon,
        html body main.dashboard-shell.dashboard-exact-only .ip-activity-icon {
          width: 24px !important;
          height: 24px !important;
          margin: 0 !important;
          justify-self: center !important;
          align-self: start !important;
        }
        /* Use full To-Do card height for visible list content. */
        html body main.dashboard-shell.dashboard-exact-only .ip-todo {
          display: flex !important;
          flex-direction: column !important;
          height: 410px !important;
          min-height: 410px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-card-head,
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-tabs,
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-todo-stats,
        html body main.dashboard-shell.dashboard-exact-only .ip-todo .ip-todo-title {
          flex: 0 0 auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          max-height: none !important;
          height: auto !important;
          overflow-y: auto !important;
          padding-bottom: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-todo-list .ip-todo-item {
          min-height: 44px !important;
        }
        /* Use full Upcoming Schedules card height for visible timeline content. */
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule {
          display: flex !important;
          flex-direction: column !important;
          height: 292px !important;
          min-height: 292px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule .ip-card-head {
          flex: 0 0 auto !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-list {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          max-height: none !important;
          height: auto !important;
          overflow-y: auto !important;
          padding-bottom: 8px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-schedule-item {
          min-height: 62px !important;
        }
        /* Seven-step workflow auto-fit. */
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow {
          display: flex !important;
          flex-direction: column !important;
          height: 196px !important;
          min-height: 196px !important;
          overflow: hidden !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-card-head {
          flex: 0 0 auto !important;
          min-height: 42px !important;
          padding: 8px 18px 4px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-card-head h3 {
          font-size: 13px !important;
          line-height: 1.2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-card-head p {
          margin-top: 3px !important;
          font-size: 11px !important;
          line-height: 1.2 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-steps {
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
          min-width: 0 !important;
          padding: 14px 18px 6px !important;
          display: grid !important;
          grid-template-columns: repeat(7, minmax(78px, 1fr)) !important;
          column-gap: 8px !important;
          align-items: stretch !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-step {
          display: grid !important;
          grid-template-rows: 44px minmax(28px, auto) 24px !important;
          align-content: start !important;
          justify-items: center !important;
          gap: 5px !important;
          min-width: 0 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-step-circle {
          width: 44px !important;
          height: 44px !important;
          min-height: 44px !important;
          font-size: 18px !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-step-line {
          top: 22px !important;
          left: calc(50% + 22px) !important;
          width: calc(100% - 44px) !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-step strong {
          width: 100% !important;
          max-width: 104px !important;
          min-height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          white-space: normal !important;
          overflow: hidden !important;
          font-size: 11px !important;
          line-height: 1.12 !important;
        }
        html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-step-action {
          width: min(100%, 104px) !important;
          max-width: 104px !important;
          height: 24px !important;
          min-height: 24px !important;
          padding: 0 8px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 10px !important;
        }
        @media (max-width: 1180px) {
          html body main.dashboard-shell.dashboard-exact-only .ip-workflow {
            overflow-x: auto !important;
          }
          html body main.dashboard-shell.dashboard-exact-only .ip-workflow .ip-steps {
            min-width: 720px !important;
          }
        }`}</style>

      <aside className="ip-exact-sidebar">
        <div className="ip-exact-logo">
          <div className="ip-exact-logo-mark"><i className="ti ti-send" /></div>
          <div className="ip-exact-logo-copy">
            <strong>IntelliMail<span>Pilot</span></strong>
            <small>MAIL PILOT</small>
          </div>
        </div>
        <div className="ip-exact-search"><i className="ti ti-search" /><span>Search anything...</span></div>
        <nav>
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <div className="ip-exact-nav-label">{group.label}</div>
              {group.items.map(([label, icon, href, active]) => (
                <a
                  key={label}
                  className={`ip-exact-nav-link ${active ? 'active' : ''}`}
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(href);
                  }}
                >
                  <i className={`ti ${icon}`} />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="ip-collapse"><i className="ti ti-chevrons-left" /><span>Collapse</span></div>
      </aside>

      <section className="ip-exact-main">
        <header className="ip-exact-topbar">
          <button type="button" className="ip-topbar-menu" aria-label="Toggle sidebar menu" onClick={onSidebarToggle}><i className="ti ti-menu-2" /></button>
          <label className="ip-top-control">
            <i className="ti ti-home" />
            <span>Select Project</span>
            <select value={topbar.project || ''} onChange={(event) => onProjectChange?.(event.target.value)}>
              <option value="">TEC Project</option>
              {(topbar.projectOptions || []).map((item) => <option key={item} value={item}>{String(item).toUpperCase()} Project</option>)}
              <option value="__add__">Add Project</option>
            </select>
          </label>
          <label className="ip-top-control sender">
            <i className="ti ti-id-badge-2" />
            <span>Select ID</span>
            <select value={topbar.selectedSenderAccountId || ''} onChange={(event) => onSenderChange?.(event.target.value)}>
              <option value="">All Sender IDs</option>
              {(topbar.senderAccounts || []).map((account) => <option key={account.id} value={account.id}>{account.from}</option>)}
              <option value="__oauth_add__">Add New Mail</option>
            </select>
          </label>
          <label className="ip-top-control date">
            <i className="ti ti-calendar" />
            <span>Date Range</span>
            <select value={topbar.selectedRange || ''} onChange={(event) => onRangeChange?.(event.target.value)}>
              <option value="">{topbar.rangeLabel || 'Select Date'}</option>
              {(topbar.rangeOptions || []).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <div className="ip-top-toggle">
            <button type="button" aria-label="Light mode"><i className="ti ti-sun" /></button>
            <button type="button" aria-label="Dark mode"><i className="ti ti-moon" /></button>
          </div>
          <button type="button" className="ip-bell" aria-label="Notifications" onClick={() => navigate('/dashboard/user?view=timeline')}><i className="ti ti-bell" /><span>{Math.min(99, Number(topbar.notificationCount || 0))}</span></button>
          <button type="button" className="ip-create" onClick={onCreateCampaign}><i className="ti ti-plus" /><span>Create Campaign</span></button>
          <div className="ip-user">
            {user.avatar ? <img className="ip-user-avatar" src={user.avatar} alt={user.name || 'User'} /> : <div className="ip-user-avatar">{user.initials || 'A'}</div>}
            <strong>{user.name || 'Akshay More'}</strong>
            <small>{user.role || 'Admin'}</small>
          </div>
        </header>

        <main className="ip-content">
          <section className="ip-welcome">
            <h1>Welcome back, Akshay! <span>👋</span></h1>
            <p>Here's what's happening with your campaigns today.</p>
          </section>

          <section className="ip-stats">
            {displayStats.map(([label, value, meta, icon, tone]) => (
              <article key={label} className={`ip-stat ${tone}`}>
                <span className="ip-stat-icon"><i className={`ti ${icon}`} /></span>
                <div>
                  <label>{label}</label>
                  <strong>{value}</strong>
                  <small>{meta}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="ip-grid">
            <div className="ip-left">
              <section className="ip-card ip-workflow">
                <div className="ip-card-head">
                  <div>
                    <h3>Campaign Workflow Progress</h3>
                    <p>Complete each step to launch your campaign</p>
                  </div>
                </div>
                <div className="ip-steps">
                  {displayWorkflow.map(([title, action, icon], index) => (
                    <div key={title} className="ip-step">
                      {index < displayWorkflow.length - 1 ? <span className="ip-step-line" /> : null}
                      <button type="button" className="ip-step-circle" onClick={() => (onWorkflowStep || onCreateCampaign)?.(index, title)}>
                        <i className={`ti ${icon}`} />
                        <em>{index + 1}</em>
                      </button>
                      <strong>{title}</strong>
                      <button type="button" className="ip-step-action" onClick={() => (onWorkflowStep || onCreateCampaign)?.(index, title)}>{action}</button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="ip-chart-row">
                <section className="ip-card ip-line">
                  <div className="ip-card-head">
                    <h3>Email Sent Overview <i className="ti ti-info-circle" /></h3>
                    <button type="button">Last 10 Days</button>
                  </div>
                  <div className="ip-line-body">
                    <svg viewBox="0 0 640 230" aria-hidden="true">
                      <defs><linearGradient id="ipArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity=".22" /><stop offset="100%" stopColor="#4f46e5" stopOpacity="0" /></linearGradient></defs>
                      {[40,80,120,160,200].map((y) => <line key={y} x1="35" x2="620" y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />)}
                      <path d={chartAreaPath} fill="url(#ipArea)" />
                      <path d={chartLinePath} fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
                      {(chartPoints.length ? chartPoints : [{ x: 42, y: 155 }, { x: 148, y: 154 }, { x: 250, y: 112 }, { x: 350, y: 73 }, { x: 462, y: 103 }, { x: 560, y: 145 }, { x: 620, y: 126 }]).map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="5" fill="#4f46e5" />)}
                    </svg>
                    <div className="ip-axis">{(chartPoints.length ? chartPoints.map((point) => point.label) : ['09 Jun','10 Jun','11 Jun','12 Jun','13 Jun','14 Jun','15 Jun','16 Jun','17 Jun','18 Jun']).map((d) => <span key={d}>{d}</span>)}</div>
                  </div>
                </section>

                <section className="ip-card ip-donut-card">
                  <div className="ip-card-head"><h3>Campaign Status</h3></div>
                  <div className="ip-donut-layout">
                    <div className="ip-donut" />
                    <div className="ip-legend">
                      {displayStatusLegend.map(([label, color, value]) => <div className="ip-legend-row" key={label}><span className="ip-dot" style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>)}
                    </div>
                  </div>
                  <div className="ip-total"><span>Total Campaigns</span><strong>{Number(totalCampaigns ?? displayCampaigns.length).toLocaleString()}</strong></div>
                </section>
              </div>

              <section className="ip-card ip-table-card">
                <div className="ip-card-head"><h3>Recent Campaigns</h3><button type="button" onClick={() => navigate('/campaigns')}>View All</button></div>
                <div className="ip-table-wrap">
                  <table className="ip-table">
                    <thead>
                      <tr><th>Sr No.</th><th>Campaign Name</th><th>Project</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Open Rate</th><th>Reply Rate</th><th>Scheduled On</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {displayCampaigns.length === 0 ? <tr><td colSpan="10" className="ip-empty-cell">No campaigns found for selected filters.</td></tr> : null}
                      {displayCampaigns.map(([name, type, project, status, recipients, sent, open, reply, scheduled, raw], index) => (
                        <tr key={`${name}-${index}`}>
                          <td className="ip-sr-no">{index + 1}</td>
                          <td><button type="button" className="ip-campaign-name" onClick={() => onCampaignAction?.(raw)}>{name}</button><small>{type}</small></td>
                          <td><span className="ip-badge">{project}</span></td>
                          <td><span className={`ip-badge ip-status ${String(status || '').toLowerCase()}`}>{status}</span></td>
                          <td>{recipients}</td><td>{sent}</td><td>{open}</td><td>{reply}</td><td>{scheduled}</td>
                          <td><div className="ip-actions"><button type="button" onClick={() => onCampaignAction?.(raw)} aria-label="Open campaign details"><i className="ti ti-chart-bar" /></button><button type="button" onClick={() => onCampaignAction?.(raw)} aria-label="Campaign actions"><i className="ti ti-dots" /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="ip-right">
              <section className="ip-card ip-todo">
                <div className="ip-card-head"><h3>My Notes, Tasks & To-Do</h3><button type="button" onClick={() => onTodoAdd?.(todoTab === 'Notes' ? 'Note' : todoTab === 'Reminders' ? 'Reminder' : 'Task')}>+ Add New</button></div>
                <div className="ip-tabs">{['Notes','Tasks','Reminders','To-Do'].map((tab) => <button key={tab} type="button" className={todoTab === tab ? 'active' : ''} onClick={() => setTodoTab(tab)}>{tab}</button>)}</div>
                <div className="ip-todo-stats"><span>All Tasks<strong>{todoStats?.all ?? displayTodos.length}</strong></span><span>Pending<strong>{todoStats?.pending ?? 0}</strong></span><span>Completed<strong>{todoStats?.completed ?? 0}</strong></span><span>Overdue<strong>{todoStats?.overdue ?? 0}</strong></span></div>
                <div className="ip-todo-title"><strong>{todoTab} List</strong><button type="button" onClick={onTodoViewAll}>View All</button></div>
                <div className="ip-todo-list">
                  {todoLoading ? <p className="ip-empty-text">Loading saved items...</p> : null}
                  {!todoLoading && displayTodos.length === 0 ? <p className="ip-empty-text">No saved items yet.</p> : null}
                  {displayTodos.map(([title, time, priority, raw], index) => <article key={`${title}-${index}`} className="ip-todo-item"><button type="button" className="ip-todo-complete" onClick={() => onTodoComplete?.(raw)} aria-label="Mark complete"><span className="ip-timeline-dot" /></button><strong>{title}</strong><small>{time}</small><em className={`ip-priority ${String(priority || 'medium').toLowerCase()}`}>{priority}</em><span className="ip-todo-actions"><button type="button" onClick={() => onTodoEdit?.(raw)} aria-label="Edit item"><i className="ti ti-pencil" /></button><button type="button" onClick={() => onTodoDelete?.(raw)} aria-label="Delete item"><i className="ti ti-trash" /></button></span></article>)}
                </div>
              </section>
              <section className="ip-card ip-schedule">
                <div className="ip-card-head"><h3>Upcoming Schedules</h3><button type="button" onClick={onScheduleViewAll}>View All</button></div>
                <div className="ip-schedule-list">
                  {displaySchedules.length === 0 ? <p className="ip-empty-text">No scheduled campaigns for selected filters.</p> : null}
                  {displaySchedules.map(([time, date, title, meta, raw]) => <button type="button" className="ip-schedule-item" key={title}><time>{time}<small>{date}</small></time><span className="ip-schedule-icon"><i className="ti ti-calendar-event" /></span><div className="ip-item-copy"><strong>{title}</strong><small>{meta}</small></div></button>)}
                </div>
              </section>
              <section className="ip-card ip-activity">
                <div className="ip-card-head"><h3>Recent Activity</h3><button type="button" onClick={onActivityViewAll}>View All</button></div>
                <div className="ip-activity-list">
                  {displayActivities.length === 0 ? <p className="ip-empty-text">No recent activity for selected filters.</p> : null}
                  {displayActivities.map(([time, date, title, meta, icon, tone, raw]) => <button type="button" className="ip-activity-item" key={title}><time>{time}<small>{date}</small></time><span className={`ip-activity-icon ${tone}`}><i className={`ti ${icon}`} /></span><div className="ip-item-copy"><strong>{title}</strong><small>{meta}</small></div></button>)}
                </div>
              </section>
            </aside>
          </section>

          <div className="ip-tip"><i className="ti ti-bulb" /> <strong>Tip:</strong> Complete all workflow steps to ensure smooth campaign execution and better deliverability.</div>
          <footer className="ip-footer"><span>© 2026 IntelliMailPilot. All rights reserved.</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/help">Help Center</a></nav></footer>
        </main>
      </section>
    </div>
  );
}

