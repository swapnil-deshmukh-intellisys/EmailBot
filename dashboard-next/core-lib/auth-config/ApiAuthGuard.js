import { NextResponse } from 'next/server';
import {
  getBlockedStatusMessage,
  getSessionFromRequest,
  isActiveAccountStatus,
  normalizeUserEmail,
  normalizeUserRole
} from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import UserProfile from '@/models/UserProfile';

function buildSeededCurrentUser(session = null) {
  const sessionId = String(session?.id || '').trim();
  const identifier = normalizeUserEmail(session?.identifier || session?.email || '');
  const email = normalizeUserEmail(session?.email || session?.identifier || '');
  if (!session || !sessionId.startsWith('seed-') || !identifier) return null;

  return {
    _id: null,
    id: sessionId,
    identifier,
    email,
    role: normalizeUserRole(session?.role || 'user'),
    status: 'active'
  };
}

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
  const seededCurrentUser = buildSeededCurrentUser(session);
  const currentUser = await UserProfile.findOne({ identifier });
  const resolvedCurrentUser = seededCurrentUser || currentUser;
  if (!resolvedCurrentUser) {
    return {
      session,
      currentUser: null,
      ownerFilter: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const status = String((seededCurrentUser ? 'active' : resolvedCurrentUser.status) || '').toLowerCase();
  if (!allowPending && !isActiveAccountStatus(status)) {
    return {
      session,
      currentUser: resolvedCurrentUser,
      ownerFilter: null,
      errorResponse: NextResponse.json(
        { error: getBlockedStatusMessage(status), status },
        { status: status === 'pending' ? 403 : 403 }
      )
    };
  }

  return {
    session,
    currentUser: resolvedCurrentUser,
    ownerFilter: buildOwnerFilter(resolvedCurrentUser),
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
