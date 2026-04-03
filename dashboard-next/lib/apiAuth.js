import { NextResponse } from 'next/server';
import { getSessionFromRequest, normalizeUserEmail } from '@/lib/auth';

export function requireUser(req) {
  const session = getSessionFromRequest(req);
  const email = normalizeUserEmail(session?.email || '');
  if (!session || !email) {
    return {
      userEmail: '',
      session: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  return { userEmail: email, session, errorResponse: null };
}

