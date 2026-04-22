import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import PresetSender from '@/models/PresetSender';
import SenderAccount from '@/models/SenderAccount';
import { verifyAccountConnection } from '@/lib/emailSender';
import { getProjectGraphConfig, getRuntimeSenderAccounts } from '@/lib/senderAccounts';
import { requireAuth, requireUser } from '@/lib/apiAuth';

const ACCOUNTS_CACHE_TTL_MS = 15000;

function getAccountsCache() {
  if (!global.__accountsCache) {
    global.__accountsCache = new Map();
  }
  return global.__accountsCache;
}

function toPublicAccount(a) {
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    from: a.from,
    status: a.status || 'Connected',
    lastSync: a.lastSync || a.updatedAt || a.createdAt || null,
    dailyLimit: a.dailyLimit || 250,
    sentToday: a.sentToday || 18,
    errors: a.errors || 0,
    health: a.health || 'Good'
  };
}

function getPresetSenderEmails(project = "") {
  const p = String(project || "").trim().toLowerCase();
  const tec = process.env.PRESET_SENDER_EMAILS_TEC;
  const tut = process.env.PRESET_SENDER_EMAILS_TUT;
  const raw = String((p === "tut" ? (tut || "") : (p === "tec" ? (tec || "") : "")) || process.env.PRESET_SENDER_EMAILS || process.env.SENDER_EMAILS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\n\r]+/g)
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}


export async function GET(req) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();

  const url = new URL(req.url);
  const project = String(url.searchParams.get("project") || "").trim().toLowerCase();
  const cacheKey = `${userEmail}::${project || '__all__'}`;
  const cache = getAccountsCache();
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ accounts: cached.accounts });
  }

  const envAccounts = getRuntimeSenderAccounts(project).map(toPublicAccount);

  const [oauthAccounts, dbAccounts, dbPreset] = await Promise.all([
    GraphOAuthAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
    SenderAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
    project ? PresetSender.find({ project }).lean() : PresetSender.find().lean()
  ]);
  const oauthPublic = oauthAccounts.map((a) => ({
    id: `oauth:${String(a._id)}`,
    provider: 'graph_oauth',
    label: 'Outlook / Microsoft 365',
    from: a.email,
    status: a.status || 'Connected',
    lastSync: a.lastSync || a.updatedAt || a.createdAt || null,
    dailyLimit: a.dailyLimit || 250,
    sentToday: a.sentToday || 18,
    errors: a.errors || 0,
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
    sentToday: a.sentToday || 18,
    errors: a.errors || 0,
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
  const graphAppReady = Boolean(graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret);

  const dbPresetPublic = dbPreset
    .filter((entry) => !seen.has(String(entry.email || "").toLowerCase()))
    .map((entry) => ({
      id: `graphapp:${String(entry.email || "").toLowerCase()}`,
      provider: "graph",
      label: "Outlook / Microsoft 365 (Graph App)",
      from: String(entry.email || "").toLowerCase(),
      project: entry.project,
      status: graphAppReady ? "Connected" : "Not configured",
      lastSync: graphAppReady ? new Date().toISOString() : null,
      dailyLimit: 250,
      sentToday: 18,
      errors: 0,
      health: graphAppReady ? "Good" : "Needs setup"
    }));

  const presetPublic = presetEmails
    .filter((email) => !seen.has(email))
    .filter((email) => !dbPresetEmails.includes(email))
    .map((email) => ({
      id: `graphapp:${email}`,
      provider: "graph",
      label: "Outlook / Microsoft 365 (Graph App)",
      from: email,
      project,
      status: graphAppReady ? "Connected" : "Not configured",
      lastSync: graphAppReady ? new Date().toISOString() : null,
      dailyLimit: 250,
      sentToday: 18,
      errors: 0,
      health: graphAppReady ? "Good" : "Needs setup"
    }));

  let accounts = [...envAccounts, ...oauthPublic, ...dbPublic, ...dbPresetPublic, ...presetPublic];
  if ((project === "tec" || project === "tut") && presetEmails.length) {
    const allowed = new Set(presetEmails);
    accounts = accounts.filter((a) => allowed.has(String(a.from || "").toLowerCase()));
  }

  cache.set(cacheKey, {
    accounts,
    expiresAt: now + ACCOUNTS_CACHE_TTL_MS
  });

  return NextResponse.json({ accounts });
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
        sentToday: created.sentToday || 18,
        errors: created.errors || 0,
        health: created.health || 'Good'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to add account' }, { status: 400 });
  }
}
