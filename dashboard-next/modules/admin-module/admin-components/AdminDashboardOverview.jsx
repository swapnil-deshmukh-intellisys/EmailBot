import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '@/app/components/ui/UiComponentExports';

function statusVariant(status = '') {
  const value = String(status).toLowerCase();
  if (value === 'active' || value === 'running' || value === 'approved' || value === 'completed') return 'success';
  if (value === 'pending' || value === 'draft' || value === 'scheduled') return 'warning';
  if (value === 'rejected' || value === 'failed' || value === 'paused') return 'danger';
  return 'neutral';
}

function rate(total, part) {
  if (!total) return '0%';
  return `${Math.round((Number(part) / Number(total)) * 100)}%`;
}

function toneVariant(tone = '') {
  const value = String(tone).toLowerCase();
  if (value === 'green') return 'success';
  if (value === 'violet') return 'info';
  if (value === 'orange') return 'warning';
  return 'default';
}

function toneClass(tone = '') {
  return `admin-kpi-ring ${String(tone || '').toLowerCase()}`;
}

export default function AdminDashboardView({ adminEmail, kpis, approvals, campaigns, sheets, users, logs }) {
  return (
    <section className="dashboard-page role-dashboard-page admin-dashboard-page">
      <Card className="dashboard-panel admin-hero-panel">
        <CardHeader className="admin-hero-header">
          <div>
            <CardDescription>Master control center</CardDescription>
            <CardTitle>IntelliMailPilot Admin</CardTitle>
          </div>
          <Badge variant="success" dot>System online</Badge>
        </CardHeader>
        <CardContent className="admin-hero-content">
          <p className="admin-hero-copy">
            Manage approvals, users, campaigns, drafts, sheets, and client data from one place. This page is the control point for every account in the system.
          </p>
          <div className="admin-hero-stats">
            <div>
              <span>Control scope</span>
              <strong>All users</strong>
            </div>
            <div>
              <span>Access model</span>
              <strong>Approval-based</strong>
            </div>
            <div>
              <span>Admin email</span>
              <strong>{adminEmail}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="dashboard-panel admin-topbar-panel">
        <CardHeader className="admin-topbar-header">
          <div className="admin-topbar-copy">
            <CardDescription>Command center</CardDescription>
            <CardTitle>Admin Dashboard</CardTitle>
            <p className="admin-topbar-subcopy">Search, approve, manage campaigns, and control access from one place.</p>
          </div>
          <div className="admin-topbar-actions">
            <input className="admin-search input" placeholder="Search users, campaigns, sheets, logs" />
            <Badge variant="info" dot>Live</Badge>
            <div className="admin-topbar-profile">
              <span className="admin-topbar-avatar">AD</span>
              <div>
                <strong>Admin</strong>
                <p>{adminEmail}</p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="admin-kpi-strip">
        {kpis.map((item) => (
          <Card key={item.label} className={`dashboard-stat-card admin-kpi-card ${toneClass(item.tone)}`}>
            <CardContent className="admin-kpi-card-content">
              <div className="admin-kpi-ring-shell" aria-hidden="true">
                <svg viewBox="0 0 120 120" className="admin-kpi-ring-svg">
                  <circle className="admin-kpi-ring-track" cx="60" cy="60" r="46" />
                  <circle className="admin-kpi-ring-value" cx="60" cy="60" r="46" />
                </svg>
                <div className="admin-kpi-ring-center">
                  <strong>{item.value}</strong>
                </div>
              </div>
              <div className="admin-kpi-copy">
                <p>{item.label}</p>
                <span>{item.detail}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="admin-command-row">
        <button className="admin-command-button">+ Add User</button>
        <button className="admin-command-button">+ Create Campaign</button>
        <button className="admin-command-button">! View Issues</button>
        <button className="admin-command-button ghost">Bell Notifications</button>
      </div>

      <div className="admin-grid two-up">
        <Card className="dashboard-chart-card admin-table-card" id="approvals">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>ID Approvals</CardTitle>
              <CardDescription>Review and control incoming access requests. Filter, search, and approve in bulk.</CardDescription>
            </div>
            <Badge variant="warning" dot>Pending</Badge>
          </CardHeader>
          <CardContent>
            <div className="admin-table-toolbar">
              <input className="admin-search input" placeholder="Search approvals" />
              <select className="admin-search input">
                <option>All</option>
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
              <button className="admin-command-button ghost">Bulk approve</button>
            </div>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.length ? approvals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell><Badge variant={statusVariant(item.status)} dot>{item.status}</Badge></TableCell>
                      <TableCell className="admin-table-actions">
                        <button className="admin-inline-action approve">Approve</button>
                        <button className="admin-inline-action reject">Reject</button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5}>No pending approvals right now.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="dashboard-chart-card admin-table-card" id="campaigns">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>Campaign Control</CardTitle>
              <CardDescription>Monitor the live campaign fleet and enforce controls with view, pause, and stop actions.</CardDescription>
            </div>
            <Badge variant="success" dot>{campaigns.length} campaigns</Badge>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Emails Sent</TableHead>
                    <TableHead>Open Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.slice(0, 5).map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>{campaign.name}</TableCell>
                      <TableCell>{campaign.owner}</TableCell>
                      <TableCell>{campaign.sent}</TableCell>
                      <TableCell>{rate(campaign.total || campaign.sent || 1, campaign.sent)}</TableCell>
                      <TableCell><Badge variant={statusVariant(campaign.status)} dot>{campaign.status}</Badge></TableCell>
                      <TableCell className="admin-table-actions">
                        <button className="admin-inline-action">View</button>
                        <button className="admin-inline-action warn">Pause</button>
                        <button className="admin-inline-action danger">Stop</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>

      <div className="admin-user-preview">
        <Card className="dashboard-chart-card admin-preview-card">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>User 360 Preview</CardTitle>
              <CardDescription>Search a user and open the full master detail page.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="admin-preview-grid">
              <div className="admin-preview-main">
                <span className="admin-preview-badge">User Profile</span>
                <strong>Full access trace, campaigns, sheets, drafts, and logs</strong>
                <p>Every account can be reviewed from one place with approval, role, credit, and activity context.</p>
              </div>
              <div className="admin-preview-side">
                <div className="admin-preview-mini">
                  <span>Approved</span>
                  <strong>Live access</strong>
                </div>
                <div className="admin-preview-mini">
                  <span>Campaigns</span>
                  <strong>History linked</strong>
                </div>
                <div className="admin-preview-mini">
                  <span>Sheets</span>
                  <strong>Upload trace</strong>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="admin-grid two-up">
        <Card className="dashboard-chart-card admin-table-card" id="sheets">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>Sheets / Data Management</CardTitle>
              <CardDescription>Uploaded sheets, validation status, and record quality at a glance.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet Name</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheets.map((sheet) => (
                    <TableRow key={sheet.name}>
                      <TableCell>{sheet.name}</TableCell>
                      <TableCell>{sheet.uploadedBy}</TableCell>
                      <TableCell>{sheet.records}</TableCell>
                      <TableCell>{sheet.errors}</TableCell>
                      <TableCell><Badge variant={sheet.status === 'Clean' ? 'success' : 'warning'} dot>{sheet.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <Card className="dashboard-chart-card admin-table-card" id="users">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Role, campaign count, and account controls with edit and disable actions.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.slice(0, 5).map((user) => (
                    <TableRow key={user.email}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.email === adminEmail ? 'Admin' : user.email.includes('mgr') ? 'Manager' : 'User'}</TableCell>
                      <TableCell>{user.campaigns}</TableCell>
                      <TableCell><Badge variant={statusVariant(user.status)} dot>{user.status}</Badge></TableCell>
                      <TableCell className="admin-table-actions">
                        <button className="admin-inline-action">Edit</button>
                        <button className="admin-inline-action danger">Disable</button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>

      <div className="admin-grid two-up">
        <Card className="dashboard-chart-card admin-table-card" id="logs">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>System Activity Logs</CardTitle>
              <CardDescription>Recent admin and campaign events with a clean audit trail.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="admin-log-list">
              {logs.map((log) => (
                <div key={`${log.time}-${log.action}`} className="admin-log-item">
                  <strong>{log.time}</strong>
                  <span>{log.action}</span>
                  <small>{log.user}</small>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-chart-card admin-table-card" id="settings">
          <CardHeader className="dashboard-chart-card-header">
            <div>
              <CardTitle>Settings</CardTitle>
              <CardDescription>SMTP, limits, spam, and API controls prepared for future wiring.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="admin-settings-grid">
              <div className="admin-setting-chip">SMTP configs</div>
              <div className="admin-setting-chip">Credit limits</div>
              <div className="admin-setting-chip">Spam settings</div>
              <div className="admin-setting-chip">API keys</div>
            </div>
            <p className="muted admin-settings-copy">
              This panel is ready to connect to real admin controls for mail delivery, limits, and security.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
