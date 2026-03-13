import { NextResponse } from 'next/server';
import crypto from 'crypto';

function base64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function GET(req) {
  const clientId = process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  const tenant = process.env.MS_TENANT_ID || process.env.MS_OAUTH_TENANT || process.env.TENANT_ID || 'common';
  if (!clientId) {
    return NextResponse.json({ error: 'MS_CLIENT_ID (or MS_OAUTH_CLIENT_ID/CLIENT_ID) is not set' }, { status: 500 });
  }

  const url = new URL(req.url);
  const returnTo = url.searchParams.get('returnTo') || '/dashboard';
  const expectedEmail = (url.searchParams.get('expectedEmail') || '').trim().toLowerCase();
  const loginHint = (url.searchParams.get('loginHint') || expectedEmail).trim();

  const state = base64Url(crypto.randomBytes(24));
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());

  const redirectUri = process.env.MS_REDIRECT_URI || `${url.origin}/api/graph-oauth/callback`;
  const scope = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
    'Mail.Send'
  ].join(' ');

  const authUrl = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');
  if (loginHint) {
    authUrl.searchParams.set('login_hint', loginHint);
  }

  const res = NextResponse.redirect(authUrl);
  const opts = { httpOnly: true, sameSite: 'lax', path: '/', secure: false };
  res.cookies.set('ms_oauth_state', state, opts);
  res.cookies.set('ms_oauth_verifier', verifier, opts);
  res.cookies.set('ms_oauth_return', returnTo, opts);
  if (expectedEmail) {
    res.cookies.set('ms_oauth_expected', expectedEmail, opts);
  }
  return res;
}
