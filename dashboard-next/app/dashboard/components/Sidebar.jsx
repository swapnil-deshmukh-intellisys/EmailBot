import React from 'react';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS } from '../DashboardNavigationLayoutConfig';

export default function Sidebar({ activeSidebarView, setActiveSidebarView }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark"><i className="ti ti-mail"></i></div>
        <div className="logo-text">IntelliMailPilot</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {SIDEBAR_PRIMARY_ITEMS.map(item => (
          <a
            key={item.id}
            className={`nav-item ${activeSidebarView === item.id ? 'active' : ''}`}
            onClick={() => setActiveSidebarView(item.id)}
          >
            <i className={item.iconClassName}></i>{item.label}
          </a>
        ))}
        <div className="nav-section-label">Workspace</div>
        {SIDEBAR_WORKSPACE_ITEMS.map(item => (
          <a
            key={item.id}
            className={`nav-item ${activeSidebarView === item.id ? 'active' : ''}`}
            onClick={() => setActiveSidebarView(item.id)}
          >
            <i className={item.iconClassName}></i>{item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="plan-card">
          <div className="plan-header"><span>Upgrade Plan</span></div>
        </div>
      </div>
    </aside>
  );
}
