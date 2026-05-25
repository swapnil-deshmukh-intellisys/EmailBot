import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import PresetSender from '@/models/PresetSender';
import SenderAccount from '@/models/SenderAccount';
import { verifyAccountConnection } from '@/lib/emailSender';
import { getProjectGraphConfig, getRuntimeSenderAccounts } from '@/lib/senderAccounts';
import { requireAuth, requireUser } from '@/lib/apiAuth';
import { isGraphAppOnlyEnabled } from '@/core-lib/mail-engine/MicrosoftGraphOAuthScopes';

const ACCOUNTS_CACHE_TTL_MS = 15000;
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};
const DEFAULT_PROJECT_PRESET_SENDERS = {
  tec: [
    'lily@theentrepreneurialchronicle.com',
    'charlie@theentrepreneurialchronicle.com',
    'robert@theentrepreneurialchronicle.com',
    'mark@theentrepreneurialchronicle.com',
    'juan@theentrepreneurialchronicle.com',
    'manuel@theentrepreneurialchronicle.com',
    'antonio@theentrepreneurialchronicle.com',
    'john@theentrepreneurialchronicle.com',
    'sam@theentrepreneurialchronicle.com',
    'clara@theentrepreneurialchronicle.com',
    'sophia@theentrepreneurialchronicle.com',
    'jess@theentrepreneurialchronicle.com',
    'diana@theentrepreneurialchronicle.com',
    'victoria@theentrepreneurialchronicle.com',
    'alina@theentrepreneurialchronicle.com',
    'amelia@theentrepreneurialchronicle.com',
    'grace@theentrepreneurialchronicle.com',
    'eliana@theentrepreneurialchronicle.com',
    'liam@theentrepreneurialchronicle.com',
    'emma@theentrepreneurialchronicle.com',
    'fiona@theentrepreneurialchronicle.com',
    'daniel@theentrepreneurialchronicle.com',
    'lacy@theentrepreneurialchronicle.com'
  ],
  tut: [
    'matt@theunicorntimes.com',
    'jordan@theunicorntimes.com',
    'jessica@theunicorntimes.com',
    'ethan@theunicorntimes.com',
    'lily@theunicorntimes.com',
    'jasmin@theunicorntimes.com',
    'kevin@theunicorntimes.com',
    'peter@theunicorntimes.com',
    'tyler@theunicorntimes.com',
    'olivia@theunicorntimes.com',
    'allison@theunicorntimes.com',
    'carmen@theunicorntimes.com',
    'isla@theunicorntimes.com',
    'jason@theunicorntimes.com',
    'julia@theunicorntimes.com',
    'juliana@theunicorntimes.com',
    'lena@theunicorntimes.com',
    'lisa@theunicorntimes.com',
    'lucy@theunicorntimes.com',
    'martina@theunicorntimes.com',
    'mary@theunicorntimes.com',
    'nora@theunicorntimes.com',
    'valeria@theunicorntimes.com'
  ]
};

function getAccountsCache() {
  if (!global.__accountsCache) {
    global.__accountsCache = new Map();
  }
  return global.__accountsCache;
}

function toPublicAccount(a) {
  const errorCount = Number(a?.errorCount ?? a?.errors ?? 0) || 0;
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    from: a.from,
    status: a.status || 'Connected',
    lastSync: a.lastSync || a.updatedAt || a.createdAt || null,
    dailyLimit: a.dailyLimit || 250,
    sentToday: Number(a.sentToday || 0),
    errors: errorCount,
    health: a.health || 'Good'
  };
}

function getPresetSenderEmails(project = "") {
  const p = String(project || "").trim().toLowerCase();
  const tec = process.env.PRESET_SENDER_EMAILS_TEC;
  const tut = process.env.PRESET_SENDER_EMAILS_TUT;
  const parseEmails = (value = "") =>
    String(value || "")
      .split(/[,\n\r]+/g)
      .map((s) => String(s || "").trim().toLowerCase())
      .filter(Boolean)
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (!p) {
    return Array.from(new Set([
      ...parseEmails(process.env.PRESET_SENDER_EMAILS || process.env.SENDER_EMAILS || ""),
      ...parseEmails(tec || ""),
      ...parseEmails(tut || ""),
      ...DEFAULT_PROJECT_PRESET_SENDERS.tec,
      ...DEFAULT_PROJECT_PRESET_SENDERS.tut
    ]));
  }
  const raw = String(
    p === "tut"
      ? (tut || "")
      : p === "tec"
        ? (tec || "")
        : (process.env.PRESET_SENDER_EMAILS || process.env.SENDER_EMAILS || "")
  ).trim();
  const parsed = parseEmails(raw);
  const defaults = DEFAULT_PROJECT_PRESET_SENDERS[p] || [];
  if (defaults.length) return Array.from(new Set([...parsed, ...defaults]));
  return parsed;
}


export async function GET(req) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  const url = new URL(req.url);
  const project = String(url.searchParams.get("project") || "").trim().toLowerCase();
  const ownedOnly = ['1', 'true', 'yes'].includes(String(url.searchParams.get('owned') || url.searchParams.get('ownedOnly') || '').trim().toLowerCase());
  const cacheKey = `${userEmail}::${project || '__all__'}::${ownedOnly ? 'owned' : 'all'}`;
  const cache = getAccountsCache();
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ accounts: cached.accounts }, { headers: NO_STORE_HEADERS });
  }

  const envAccounts = getRuntimeSenderAccounts(project).map(toPublicAccount);
  let oauthAccounts = [];
  let dbAccounts = [];
  let dbPreset = [];
  try {
    await connectDB();
    [oauthAccounts, dbAccounts, dbPreset] = await Promise.all([
      GraphOAuthAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
      SenderAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
      project ? PresetSender.find({ project }).lean() : PresetSender.find().lean()
    ]);
  } catch (error) {
    // Keep local development usable when database is offline/misconfigured.
    console.warn('Accounts API database fallback:', error?.message || error);
  }
  const oauthPublic = oauthAccounts.map((a) => ({
    id: `oauth:${String(a._id)}`,
    provider: 'graph_oauth',
    label: 'Outlook / Microsoft 365',
    from: a.email,
    status: a.status || 'Connected',
    lastSync: a.lastSync || a.updatedAt || a.createdAt || null,
    dailyLimit: a.dailyLimit || 250,
    sentToday: Number(a.sentToday || 0),
    errors: Number(a?.errorCount ?? a?.errors ?? 0) || 0,
    health: a.health || 'Good'
  }));

  const dbPublic = dbAccounts.map((a) => ({
    id: `db:${String(a._id)}`,
    provider: a.provider,
    label: a.label || (a.provider === 'graph' ? 'Outlook / Microsoft 365' : 'SMTP'),
    from: a.from,
    status: a.status || 'Connected',
    lastSync: a.lastSync || a.updatedAt || a.createdAt || null,
    dailyLimit: a.dailyLimit || 250,
    sentToday: Number(a.sentToday || 0),
    errors: Number(a?.errorCount ?? a?.errors ?? 0) || 0,
    health: a.health || 'Good'
  }));

  const envPresetEmails = getPresetSenderEmails(project);
  const dbPresetEmails = dbPreset
    .map((entry) => String(entry.email || '').trim().toLowerCase())
    .filter(Boolean);
  const presetEmails = Array.from(new Set([...envPresetEmails, ...dbPresetEmails]));
  const seen = new Set([
    ...envAccounts.map((a) => String(a.from || "").toLowerCase()),
    ...oauthPublic.map((a) => String(a.from || "").toLowerCase()),
    ...dbPublic.map((a) => String(a.from || "").toLowerCase())
  ]);

  const graphConfig = getProjectGraphConfig(project);
  const graphAppReady = isGraphAppOnlyEnabled() && Boolean(graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret);

  const dbPresetPublic = dbPreset
    .filter((entry) => !seen.has(String(entry.email || "").toLowerCase()))
    .map((entry) => ({
      id: `graphapp:${String(entry.email || "").toLowerCase()}`,
      provider: graphAppReady ? "graph" : "graph_oauth",
      label: graphAppReady ? "Outlook / Microsoft 365 (Graph App)" : "Outlook / Microsoft 365",
      from: String(entry.email || "").toLowerCase(),
      project: entry.project,
      status: graphAppReady ? "Connected" : "Not connected",
      lastSync: graphAppReady ? new Date().toISOString() : null,
      dailyLimit: 250,
      sentToday: 0,
      errors: 0,
      health: graphAppReady ? "Good" : "Needs setup"
    }));

  const presetPublic = presetEmails
    .filter((email) => !seen.has(email))
    .filter((email) => !dbPresetEmails.includes(email))
    .map((email) => ({
      id: `graphapp:${email}`,
      provider: graphAppReady ? "graph" : "graph_oauth",
      label: graphAppReady ? "Outlook / Microsoft 365 (Graph App)" : "Outlook / Microsoft 365",
      from: email,
      project,
      status: graphAppReady ? "Connected" : "Not connected",
      lastSync: graphAppReady ? new Date().toISOString() : null,
      dailyLimit: 250,
      sentToday: 0,
      errors: 0,
      health: graphAppReady ? "Good" : "Needs setup"
    }));

  let accounts = ownedOnly
    ? [...oauthPublic, ...dbPublic]
    : [...envAccounts, ...oauthPublic, ...dbPublic, ...dbPresetPublic, ...presetPublic];
  if ((project === "tec" || project === "tut") && presetEmails.length) {
    const allowed = new Set(presetEmails);
    accounts = accounts.filter((a) => {
      const from = String(a.from || "").toLowerCase();
      const isProjectPreset = allowed.has(from);
      const isUserOwnedConnected =
        String(a.id || "").startsWith("db:") || String(a.id || "").startsWith("oauth:");
      return isProjectPreset || isUserOwnedConnected;
    });
  }

  cache.set(cacheKey, {
    accounts,
    expiresAt: now + ACCOUNTS_CACHE_TTL_MS
  });

  return NextResponse.json({ accounts }, { headers: NO_STORE_HEADERS });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    await connectDB();
    const body = await req.json();

    const provider = String(body.provider || 'smtp').toLowerCase();
    const from = String(body.from || '').trim();
    const label = String(body.label || '').trim();

    if (!from) {
      return NextResponse.json({ error: 'from is required' }, { status: 400 });
    }
    if (!['smtp', 'gmail', 'graph'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const account = {
      provider,
      label,
      from,
      host: String(body.host || ''),
      port: Number(body.port || 587),
      secure: Boolean(body.secure),
      user: String(body.user || ''),
      pass: String(body.pass || ''),
      tenantId: String(body.tenantId || ''),
      clientId: String(body.clientId || ''),
      clientSecret: String(body.clientSecret || '')
    };

    // Verify before storing so the dropdown only shows working accounts.
    await verifyAccountConnection(account);

    const created = await SenderAccount.create({ ...account, userId: auth.currentUser._id, userEmail });
    return NextResponse.json({
      ok: true,
      account: {
        id: `db:${String(created._id)}`,
        provider: created.provider,
        label: created.label,
        from: created.from,
        status: created.status || 'Connected',
        lastSync: created.lastSync || created.updatedAt || created.createdAt || null,
        dailyLimit: created.dailyLimit || 250,
        sentToday: Number(created.sentToday || 0),
        errors: Number(created?.errorCount ?? created?.errors ?? 0) || 0,
        health: created.health || 'Good'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to add account' }, { status: 400 });
  }
}
