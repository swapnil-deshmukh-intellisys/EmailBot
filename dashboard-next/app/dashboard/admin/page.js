import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RoleDashboardShell from '@/app/components/role-dashboard/RoleDashboardShell';
import { getAuthCookieName, verifyAuthToken } from '@/lib/auth';
import { DASHBOARD_ROLES, getDashboardPathForRole } from '@/app/lib/dashboardRoles';
import { getAdminLiveData } from '@/app/lib/adminLiveData';
import AdminDashboardView from './AdminDashboardView';

function getSession() {
  const token = cookies().get(getAuthCookieName())?.value || '';
  return token ? verifyAuthToken(token) : null;
}

function dateLabel(value) {
  if (!value) return 'Never';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export default async function AdminDashboardPage() {
  const session = getSession();
  if (!session) redirect('/login');

  const sessionRole = String(session.role || '').toLowerCase();
  const sessionPath = String(session.dashboardPath || '');
  const isAdmin =
    sessionRole === DASHBOARD_ROLES.ADMIN ||
    sessionPath === getDashboardPathForRole(DASHBOARD_ROLES.ADMIN);

  if (!isAdmin) redirect('/unauthorized');

  const data = await getAdminLiveData();
  const approvals = data.users
    .filter((user) => user.status === 'Pending' || user.status === 'Inactive')
    .slice(0, 6)
    .map((user, index) => ({
      id: `USR-${String(index + 1).padStart(4, '0')}`,
      name: user.email.split('@')[0],
      email: user.email,
      status: user.status,
      lastActive: dateLabel(user.lastActive)
    }));

  const sheets = [
    { name: 'Leads_April', uploadedBy: 'Akshay', records: 5000, errors: 12, status: 'Clean' },
    { name: 'Warmup_Contacts', uploadedBy: 'Manager', records: 1800, errors: 4, status: 'Review' },
    { name: 'Client_Retail', uploadedBy: 'Admin', records: 2400, errors: 0, status: 'Clean' }
  ];

  const logs = [
    { time: '10:30 AM', action: 'Campaign Started', user: 'Akshay More' },
    { time: '10:45 AM', action: 'User Approved', user: 'Admin' },
    { time: '11:05 AM', action: 'Sheet Validated', user: 'Manager' }
  ];

  const totalEmailsSent = data.totals.totalSent;
  const activeCampaigns = data.totals.runningCampaigns;
  const pendingApprovals = approvals.length;
  const totalUsers = data.totals.totalUsers || data.users.length;

  const kpis = [
    { label: 'Total Users', value: String(totalUsers), detail: 'All active login IDs', tone: 'blue' },
    { label: 'Pending Approvals', value: String(pendingApprovals), detail: 'Accounts waiting review', tone: 'violet' },
    { label: 'Active Campaigns', value: String(activeCampaigns), detail: 'Running in the system', tone: 'green' },
    { label: 'Emails Sent Today', value: String(totalEmailsSent), detail: 'Live delivery volume', tone: 'orange' }
  ];

  return (
    <RoleDashboardShell role="admin">
      <AdminDashboardView
        adminEmail="akshaymore.intellisys@gmail.com"
        kpis={kpis}
        approvals={approvals}
        campaigns={data.campaigns}
        sheets={sheets}
        users={data.users}
        logs={logs}
      />
    </RoleDashboardShell>
  );
}
