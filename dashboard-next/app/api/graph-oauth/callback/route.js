import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import ConnectedMailAccount from '@/models/ConnectedMailAccount';
import { encryptString } from '@/lib/tokenCrypto';
import { requireAuth } from '@/lib/apiAuth';
import { DELEGATED_MAILBOX_SCOPE } from '@/core-lib/mail-engine/MicrosoftGraphOAuthScopes';

function base64UrlDecodeToJson(part) {
  const pad = '='.repeat((4 - (part.length % 4)) % 4);
  const b64 = (part + pad).replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
}

function normalizeTenantId(value, fallback = 'organizations') {
  const tenant = String(value || '').trim();
  if (!tenant || tenant.toLowerCase() === 'undefined' || tenant.toLowerCase() === 'null') {
    return fallback || 'organizations';
  }
  return tenant;
}

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();

  const isSecure = process.env.NODE_ENV === 'production';
  const clientId = process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET || process.env.MS_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const tenant = process.env.MS_OAUTH_TENANT || process.env.MS_TENANT_ID || process.env.TENANT_ID || 'organizations';

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'MS_CLIENT_ID/MS_CLIENT_SECRET (or MS_OAUTH_CLIENT_ID/MS_OAUTH_CLIENT_SECRET or CLIENT_ID/CLIENT_SECRET) are not set' }, { status: 500 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const errDesc = url.searchParams.get('error_description');

  const cookieState = req.cookies.get('ms_oauth_state')?.value || '';
  const verifier = req.cookies.get('ms_oauth_verifier')?.value || '';
  const returnTo = req.cookies.get('ms_oauth_return')?.value || '/dashboard/user';
  const expectedEmail = (req.cookies.get('ms_oauth_expected')?.value || '').trim().toLowerCase();

  if (err) {
    return NextResponse.redirect(new URL(`${returnTo}?oauth=error&message=${encodeURIComponent(errDesc || err)}`, url.origin));
  }

  if (!code || !state || !cookieState || state !== cookieState || !verifier) {
    return NextResponse.redirect(new URL(`${returnTo}?oauth=error&message=Invalid%20OAuth%20state`, url.origin));
  }

  const redirectUri = process.env.MS_REDIRECT_URI || `${url.origin}/api/graph-oauth/callback`;
  const scope = DELEGATED_MAILBOX_SCOPE;

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
    return NextResponse.redirect(new URL(`${returnTo}?oauth=error&message=${encodeURIComponent(msg)}`, url.origin));
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
    return NextResponse.redirect(new URL(`${returnTo}?oauth=error&message=${encodeURIComponent(msg)}`, url.origin));
  }

  const email = (me.mail || me.userPrincipalName || tokenClaims.preferred_username || '').toLowerCase();

  if (expectedEmail && email && expectedEmail !== email) {
    const res = NextResponse.redirect(new URL(`${returnTo}?oauth=error&message=${encodeURIComponent(`Signed in as ${email} but expected ${expectedEmail}`)}`, url.origin));
    const opts = { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecure, maxAge: 0 };
    res.cookies.set('ms_oauth_state', '', opts);
    res.cookies.set('ms_oauth_verifier', '', opts);
    res.cookies.set('ms_oauth_return', '', opts);
    res.cookies.set('ms_oauth_expected', '', opts);
    return res;
  }
  const displayName = me.displayName || '';
  const tid = normalizeTenantId(tokenClaims.tid, tenant);

  const expiresAt = new Date(Date.now() + (Number(tokenData.expires_in || 3600) * 1000));

  await connectDB();
  await GraphOAuthAccount.findOneAndUpdate(
    { email, tenantId: tid, userEmail },
    {
      $set: {
        userId: auth.currentUser?._id || null,
        userEmail,
        provider: 'microsoft',
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
  await ConnectedMailAccount.findOneAndUpdate(
    { email, tenantId: tid, userEmail },
    {
      $set: {
        userId: auth.currentUser?._id || null,
        userEmail,
        provider: 'outlook',
        displayName,
        scopes: String(tokenData.scope || '').split(' ').filter(Boolean),
        accessTokenEncrypted: encryptString(accessToken),
        refreshTokenEncrypted: encryptString(tokenData.refresh_token),
        expiresAt,
        tenantId: tid,
        status: 'Connected',
        lastSyncAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  const res = NextResponse.redirect(new URL(`${returnTo}?oauth=connected`, url.origin));
  const opts = { httpOnly: true, sameSite: 'lax', path: '/', secure: isSecure, maxAge: 0 };
  res.cookies.set('ms_oauth_state', '', opts);
  res.cookies.set('ms_oauth_verifier', '', opts);
  res.cookies.set('ms_oauth_return', '', opts);
  res.cookies.set('ms_oauth_expected', '', opts);
  return res;
}
