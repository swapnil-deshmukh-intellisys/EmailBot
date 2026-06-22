import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthCookieName, verifyAuthToken } from '@/lib/auth';
import { getDashboardPathForRole } from '@/app/lib/roleRouting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardIndexPage() {
  const token = cookies().get(getAuthCookieName())?.value || '';
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    redirect('/login');
  }

  redirect(getDashboardPathForRole(session.role));
}
