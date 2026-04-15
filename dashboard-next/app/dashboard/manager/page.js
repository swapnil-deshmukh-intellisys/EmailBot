import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RoleDashboardShell from '@/app/components/role-dashboard/RoleDashboardShell';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '@/app/components/ui';
import TargetApprovalPanel from './TargetApprovalPanel';
import { MANAGER_EMPLOYEES, MANAGER_SUMMARY } from '@/app/lib/roleDashboardData';
import { DASHBOARD_ROLES, getDashboardPathForRole, getRoleFromPath } from '@/app/lib/roleRouting';
import { getAuthCookieName, verifyAuthToken } from '@/lib/auth';

function getSession() {
  const token = cookies().get(getAuthCookieName())?.value || '';
  return token ? verifyAuthToken(token) : null;
}

const teamActivity = [
  { id: 't1', tag: 'Campaigns', msg: 'Campaign resumed for the North team', detail: 'All members inherited the latest campaign state.' },
  { id: 't2', tag: 'Employees', msg: '2 employees updated their drafts', detail: 'Changes are visible under team history.' },
  { id: 't3', tag: 'Reports', msg: 'Weekly team report generated', detail: 'Completion, replies, and pending items updated.' }
];

export default function ManagerDashboardPage() {
  const session = getSession();
  if (!session) redirect('/login');
  const sessionRole = String(session.role || '').toLowerCase();
  const sessionPath = String(session.dashboardPath || '');
  const isManager =
    sessionRole === DASHBOARD_ROLES.MANAGER ||
    sessionPath === getDashboardPathForRole(DASHBOARD_ROLES.MANAGER) ||
    getRoleFromPath(sessionPath) === DASHBOARD_ROLES.MANAGER;

  if (!isManager) {
    redirect('/unauthorized');
  }

  return (
    <RoleDashboardShell role="manager">
      <section className="dashboard-page role-dashboard-page manager-dashboard">
        <Card className="dashboard-panel manager-hero">
          <CardHeader>
            <CardDescription>Team command center</CardDescription>
            <CardTitle>Manager dashboard</CardTitle>
          </CardHeader>
          <CardContent className="admin-hero-content">
            <p className="muted">
              Track your team’s tasks, employee activity, and reports with the same dashboard language as the user workspace.
            </p>
            <div className="admin-hero-badges">
              <span className="admin-hero-badge">Team scope</span>
              <span className="admin-hero-badge">Employee history</span>
              <span className="admin-hero-badge">Team reports</span>
            </div>
          </CardContent>
        </Card>

        <div className="dashboard-stats-grid">
          {MANAGER_SUMMARY.map((item) => (
            <Card key={item.label} className="dashboard-stat-card">
              <CardHeader className="dashboard-stat-card-header">
                <CardTitle>{item.label}</CardTitle>
                <Badge variant="info" size="sm">Team KPI</Badge>
              </CardHeader>
              <CardContent className="dashboard-stat-card-content">
                <strong className="dashboard-stat-card-value">{item.value}</strong>
                <p className="dashboard-stat-card-description">
                  {item.label === 'Team Members' ? 'Scoped team members under your management.' : item.label === 'Active Tasks' ? 'Running work items and campaign tasks.' : 'Alerts that need your attention.'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="dashboard-performance-section manager-grid">
          <Card id="team-overview" className="dashboard-chart-card">
            <CardHeader className="dashboard-chart-card-header">
              <div>
                <CardTitle>Team Overview</CardTitle>
                <CardDescription>Employees and activity inside your scope.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="admin-list">
                {MANAGER_EMPLOYEES.map((employee) => (
                  <div key={employee.id} className="admin-list-item">
                    <strong>{employee.name}</strong>
                    <p>
                      {employee.id} · {employee.status} · {employee.activity}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="employees" className="dashboard-chart-card">
            <CardHeader className="dashboard-chart-card-header">
              <div>
                <CardTitle>Employees</CardTitle>
                <CardDescription>Current team members and performance snapshot.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MANAGER_EMPLOYEES.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <strong>{employee.name}</strong>
                          <div className="muted">{employee.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.status === 'Active' ? 'success' : 'warning'} dot>
                            {employee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{employee.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
        </div>

        <TargetApprovalPanel />

        <div className="dashboard-performance-section manager-grid">
          <Card id="activity" className="dashboard-chart-card">
            <CardHeader className="dashboard-chart-card-header">
              <div>
                <CardTitle>Team Activity</CardTitle>
                <CardDescription>Recent team actions and campaign updates.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="dashboard-activity-feed-content">
              {teamActivity.map((item) => (
                <div key={item.id} className="premium-log-item compact">
                  <strong>{item.tag}</strong>
                  <div>
                    <span>{item.tag}</span>
                    <p>{item.msg}</p>
                    <small>{item.detail}</small>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="reports" className="dashboard-chart-card">
            <CardHeader className="dashboard-chart-card-header">
              <div>
                <CardTitle>Team Reports</CardTitle>
                <CardDescription>Performance and delivery summary.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="admin-list">
                <div className="admin-list-item">
                  <strong>Campaign completion</strong>
                  <p>How much of the current team load is complete.</p>
                </div>
                <div className="admin-list-item">
                  <strong>Reply rate</strong>
                  <p>Response behavior across the active team.</p>
                </div>
                <div className="admin-list-item">
                  <strong>Inbox health</strong>
                  <p>Delivery, warm-up, and operational stability.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card id="history" className="dashboard-panel">
          <CardHeader>
            <CardTitle>Employee History</CardTitle>
            <CardDescription>Recent actions and timeline entries.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="admin-list">
              <div className="admin-list-item">
                <strong>Priyanka Wp</strong>
                <p>Draft updated, campaign resumed, status active</p>
              </div>
              <div className="admin-list-item">
                <strong>Adesh Wu</strong>
                <p>Pending review, list updated, recent reply captured</p>
              </div>
              <div className="admin-list-item">
                <strong>Vaishnav Sir</strong>
                <p>Awaiting approval, latest activity logged today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="profile" className="dashboard-panel">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manager account and notification preferences.</CardDescription>
          </CardHeader>
          <CardContent className="admin-form-actions">
            <div className="admin-list-item" style={{ minWidth: 'min(100%, 320px)' }}>
              <strong>Signed in as</strong>
              <p>{session.email || 'manager@intellisys.com'}</p>
            </div>
            <Button variant="secondary">Open team settings</Button>
            <Button variant="secondary">Review reports</Button>
          </CardContent>
        </Card>
      </section>
    </RoleDashboardShell>
  );
}
