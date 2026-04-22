import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  DEFAULT_ADMIN_LOGIN_ID,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_USER_PASSWORD
} from '../app/lib/authDefaults.js';

const COOKIE_NAME = 'auth_token';
export const USER_ACCOUNT_STATUSES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  REJECTED: 'rejected',
  INACTIVE: 'inactive'
};

export function getConfiguredAdminEmail() {
  const value = normalizeUserEmail(process.env.ADMIN_EMAIL || '');
  if (value) return value;
  return DEFAULT_ADMIN_LOGIN_ID;
}

export function getConfiguredAdminPassword() {
  const value = String(process.env.ADMIN_PASSWORD || '');
  if (value) return value;
  return DEFAULT_ADMIN_PASSWORD;
}

export function signAuthToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function getAuthCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds
  };
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}

function getAllowedDomains() {
  return String(process.env.ALLOWED_LOGIN_DOMAINS || 'intellisys.com')
    .split(',')
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeUserEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeLoginIdentifier(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeUserRole(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'manager') return 'manager';
  return 'user';
}

export function isActiveAccountStatus(status = '') {
  return String(status || '').trim().toLowerCase() === USER_ACCOUNT_STATUSES.ACTIVE;
}

export function getBlockedStatusMessage(status = '') {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === USER_ACCOUNT_STATUSES.ACTIVE) {
    return 'Your account is active.';
  }
  if (normalized === USER_ACCOUNT_STATUSES.PENDING) {
    return 'Your account is pending admin approval.';
  }
  if (normalized === USER_ACCOUNT_STATUSES.BLOCKED || normalized === USER_ACCOUNT_STATUSES.INACTIVE) {
    return 'Your account has been disabled. Contact admin.';
  }
  if (normalized === USER_ACCOUNT_STATUSES.REJECTED) {
    return 'Your access request was rejected. Contact admin.';
  }
  return 'Your account cannot access the dashboard.';
}

export function isAdminUserEmail(email = '') {
  const normalizedEmail = normalizeUserEmail(email);
  const adminEmail = getConfiguredAdminEmail();
  return Boolean(adminEmail) && normalizedEmail === adminEmail;
}

export function isAllowedUserEmail(email = '') {
  const normalized = normalizeUserEmail(email);
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const localPart = parts[0];
  const domain = parts[1];
  const allowedDomains = getAllowedDomains();
  const allowIntellisysPattern = String(process.env.ALLOW_INTELLISYS_PATTERN || 'true').toLowerCase() !== 'false';

  if (allowedDomains.includes(domain)) {
    return true;
  }
  if (allowIntellisysPattern && (localPart.includes('intellisys') || domain.includes('intellisys'))) {
    return true;
  }
  return false;
}

export function getSessionFromRequest(req) {
  const token = req?.cookies?.get?.(getAuthCookieName())?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

export function buildSessionPayload(profile = {}, dashboardPath = '') {
  return {
    id: String(profile?._id || profile?.id || ''),
    email: normalizeUserEmail(profile?.email || profile?.identifier || ''),
    identifier: normalizeLoginIdentifier(profile?.identifier || profile?.email || ''),
    intellisysUserId: normalizeLoginIdentifier(profile?.intellisysUserId || profile?.employeeId || profile?.identifier || ''),
    role: normalizeUserRole(profile?.role || 'user'),
    status: String(profile?.status || USER_ACCOUNT_STATUSES.ACTIVE).toLowerCase(),
    isAuthenticated: true,
    mustChangePassword: Boolean(profile?.mustChangePassword),
    dashboardPath
  };
}

export function getDefaultUserPassword() {
  return String(process.env.DEFAULT_USER_PASSWORD || DEFAULT_USER_PASSWORD);
}

export function validatePasswordStrength(password = '') {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[a-z]/.test(value)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(value)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(value)) return 'Password must include at least one number.';
  if (!/[^\w\s]/.test(value)) return 'Password must include at least one special character.';
  return '';
}

export async function hashPassword(password = '') {
  return bcrypt.hash(String(password || ''), 10);
}

export async function comparePassword(password = '', hash = '') {
  if (!String(hash || '')) return false;
  return bcrypt.compare(String(password || ''), String(hash || ''));
}

export function createResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function hashResetToken(rawToken = '') {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

export async function validateAdminCredentials(email, password) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!isAllowedUserEmail(normalizedEmail)) {
    return false;
  }

  const normalizedAdmin = getConfiguredAdminEmail();
  const adminPassword = getConfiguredAdminPassword();
  const allowAnyIntellisysUser = String(process.env.ALLOW_ANY_INTELLISYS_USER || 'true').toLowerCase() !== 'false';

  if (!normalizedAdmin) {
    return false;
  }

  if (!allowAnyIntellisysUser && normalizedEmail !== normalizedAdmin) {
    return false;
  }

  // Accept plain env password for setup simplicity.
  if (adminPassword && password === adminPassword) {
    return true;
  }

  // Optional: allow hashed password in ADMIN_PASSWORD_HASH.
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    return bcrypt.compare(password, hash);
  }

  return false;
}
