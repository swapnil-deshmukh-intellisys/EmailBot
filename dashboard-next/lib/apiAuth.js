import { NextResponse } from 'next/server';
import {
  getBlockedStatusMessage,
  getSessionFromRequest,
  isActiveAccountStatus,
  normalizeUserEmail
} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import UserProfile from '@/models/UserProfile';

export function requireUser(req) {
  const session = getSessionFromRequest(req);
  const email = normalizeUserEmail(session?.email || '');
  const status = String(session?.status || 'active').toLowerCase();
  if (!session || !email) {
    return {
      userEmail: '',
      session: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  if (status && !isActiveAccountStatus(status)) {
    return {
      userEmail: '',
      session,
      errorResponse: NextResponse.json({ error: getBlockedStatusMessage(status), status }, { status: 403 })
    };
  }

  return { userEmail: email, session, errorResponse: null };
}

export async function requireAuth(req, options = {}) {
  const { allowPending = false } = options;
  const session = getSessionFromRequest(req);
  const identifier = normalizeUserEmail(session?.identifier || session?.email || '');
  if (!session || !identifier) {
    return {
      session: null,
      currentUser: null,
      ownerFilter: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  await connectDB();
  const currentUser = await UserProfile.findOne({ identifier });
  if (!currentUser) {
    return {
      session,
      currentUser: null,
      ownerFilter: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const status = String(currentUser.status || '').toLowerCase();
  if (!allowPending && !isActiveAccountStatus(status)) {
    return {
      session,
      currentUser,
      ownerFilter: null,
      errorResponse: NextResponse.json(
        { error: getBlockedStatusMessage(status), status },
        { status: status === 'pending' ? 403 : 403 }
      )
    };
  }

  return {
    session,
    currentUser,
    ownerFilter: buildOwnerFilter(currentUser),
    errorResponse: null
  };
}

export async function requireAdmin(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth;

  const role = String(auth.currentUser?.role || auth.session?.role || '').toLowerCase();
  if (role !== 'admin') {
    return {
      ...auth,
      errorResponse: NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    };
  }

  return auth;
}

export function buildOwnerFilter(user = null, extra = {}) {
  const userId = String(user?._id || '').trim();
  const userEmail = normalizeUserEmail(user?.email || user?.identifier || '');
  const or = [];
  if (userId) or.push({ userId });
  if (userEmail) or.push({ userEmail });
  if (!or.length) return extra;
  return { ...extra, $or: or };
}
