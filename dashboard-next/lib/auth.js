import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'auth_token';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getConfiguredAdminEmail() {
  const value = normalizeUserEmail(process.env.ADMIN_EMAIL || '');
  if (value) return value;
  return isProduction() ? '' : 'akshaymore.intellisys@gmail.com';
}

function getConfiguredAdminPassword() {
  const value = String(process.env.ADMIN_PASSWORD || '');
  if (value) return value;
  return isProduction() ? '' : '1234512345@i';
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
