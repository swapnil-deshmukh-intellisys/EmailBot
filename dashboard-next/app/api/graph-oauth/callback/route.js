import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { encryptString } from '@/lib/tokenCrypto';

function base64UrlDecodeToJson(part) {
  const pad = '='.repeat((4 - (part.length % 4)) % 4);
  const b64 = (part + pad).replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
}

export async function GET(req) {
  const clientId = process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET || process.env.MS_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const tenant = process.env.MS_TENANT_ID || process.env.MS_OAUTH_TENANT || process.env.TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'MS_CLIENT_ID/MS_CLIENT_SECRET (or MS_OAUTH_CLIENT_ID/MS_OAUTH_CLIENT_SECRET or CLIENT_ID/CLIENT_SECRET) are not set' }, { status: 500 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const errDesc = url.searchParams.get('error_description');

  if (err) {
    return NextResponse.redirect(new URL(`/dashboard?oauth=error&message=${encodeURIComponent(errDesc || err)}`, url.origin));
  }

  const cookieState = req.cookies.get('ms_oauth_state')?.value || '';
  const verifier = req.cookies.get('ms_oauth_verifier')?.value || '';
  const returnTo = req.cookies.get('ms_oauth_return')?.value || '/dashboard';
  const expectedEmail = (req.cookies.get('ms_oauth_expected')?.value || '').trim().toLowerCase();

  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return NextResponse.redirect(new URL('/dashboard?oauth=error&message=Invalid%20OAuth%20state', url.origin));
  }

  const redirectUri = process.env.MS_REDIRECT_URI || `${url.origin}/api/graph-oauth/callback`;
  const scope = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
    'Mail.Send'
  ].join(' ');

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', redirectUri);
  params.set('scope', scope);
  params.set('code_verifier', verifier);

  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok || !tokenData.access_token || !tokenData.refresh_token) {
    const msg = tokenData.error_description || tokenData.error || 'Token exchange failed';
    return NextResponse.redirect(new URL(`/dashboard?oauth=error&message=${encodeURIComponent(msg)}`, url.origin));
  }

  let tokenClaims = {};
  try {
    if (tokenData.id_token) {
      const parts = String(tokenData.id_token).split('.');
      if (parts.length >= 2) {
        tokenClaims = base64UrlDecodeToJson(parts[1]);
      }
    }
  } catch (e) {
    tokenClaims = {};
  }

  const accessToken = tokenData.access_token;
  const meResp = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const me = await meResp.json();
  if (!meResp.ok) {
    const msg = me?.error?.message || 'Failed to fetch /me';
    return NextResponse.redirect(new URL(`/dashboard?oauth=error&message=${encodeURIComponent(msg)}`, url.origin));
  }

  const email = (me.mail || me.userPrincipalName || tokenClaims.preferred_username || '').toLowerCase();

  if (expectedEmail && email && expectedEmail !== email) {
    const res = NextResponse.redirect(new URL(`/dashboard?oauth=error&message=${encodeURIComponent(`Signed in as ${email} but expected ${expectedEmail}`)}`, url.origin));
    const opts = { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 };
    res.cookies.set('ms_oauth_state', '', opts);
    res.cookies.set('ms_oauth_verifier', '', opts);
    res.cookies.set('ms_oauth_return', '', opts);
    res.cookies.set('ms_oauth_expected', '', opts);
    return res;
  }
  const displayName = me.displayName || '';
  const tid = tokenClaims.tid || tenant;

  const expiresAt = new Date(Date.now() + (Number(tokenData.expires_in || 3600) * 1000));

  await connectDB();
  await GraphOAuthAccount.findOneAndUpdate(
    { email, tenantId: tid },
    {
      $set: {
        displayName,
        scopes: String(tokenData.scope || '').split(' ').filter(Boolean),
        accessTokenEnc: encryptString(accessToken),
        refreshTokenEnc: encryptString(tokenData.refresh_token),
        expiresAt,
        lastConnectedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  const res = NextResponse.redirect(new URL(`${returnTo}?oauth=connected`, url.origin));
  const opts = { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 };
  res.cookies.set('ms_oauth_state', '', opts);
  res.cookies.set('ms_oauth_verifier', '', opts);
  res.cookies.set('ms_oauth_return', '', opts);
  res.cookies.set('ms_oauth_expected', '', opts);
  return res;
}
