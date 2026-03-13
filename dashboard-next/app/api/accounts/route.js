import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import PresetSender from '@/models/PresetSender';
import SenderAccount from '@/models/SenderAccount';
import { verifyAccountConnection } from '@/lib/emailSender';
import { getRuntimeSenderAccounts } from '@/lib/senderAccounts';

function toPublicAccount(a) {
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    from: a.from,
    status: 'Connected'
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
  await connectDB();

  const url = new URL(req.url);
  const project = String(url.searchParams.get("project") || "").trim().toLowerCase();

  const envAccounts = getRuntimeSenderAccounts().map(toPublicAccount);

  const oauthAccounts = await GraphOAuthAccount.find().sort({ createdAt: -1 }).lean();
  const oauthPublic = oauthAccounts.map((a) => ({
    id: `oauth:${String(a._id)}`,
    provider: 'graph_oauth',
    label: 'Outlook / Microsoft 365',
    from: a.email,
    status: 'Connected'
  }));

  const dbAccounts = await SenderAccount.find().sort({ createdAt: -1 }).lean();
  const dbPublic = dbAccounts.map((a) => ({
    id: `db:${String(a._id)}`,
    provider: a.provider,
    label: a.label || (a.provider === 'graph' ? 'Outlook / Microsoft 365' : 'SMTP'),
    from: a.from,
    status: 'Connected'
  }));


  const presetEmails = getPresetSenderEmails(project);
  const seen = new Set([
    ...envAccounts.map((a) => String(a.from || "").toLowerCase()),
    ...oauthPublic.map((a) => String(a.from || "").toLowerCase()),
    ...dbPublic.map((a) => String(a.from || "").toLowerCase())
  ]);

  const graphAppReady = Boolean(process.env.TENANT_ID && process.env.CLIENT_ID && process.env.CLIENT_SECRET);

  const dbPreset = await PresetSender.find().lean();
  const dbPresetPublic = dbPreset
    .filter((entry) => !seen.has(String(entry.email || "").toLowerCase()))
    .map((entry) => ({
      id: `graphapp:${String(entry.email || "").toLowerCase()}`,
      provider: "graph",
      label: "Outlook / Microsoft 365 (Graph App)",
      from: String(entry.email || "").toLowerCase(),
      project: entry.project,
      status: graphAppReady ? "Connected" : "Not configured"
    }));

  const presetPublic = presetEmails
    .filter((email) => !seen.has(email))
    .map((email) => ({
      id: `graphapp:${email}`,
      provider: "graph",
      label: "Outlook / Microsoft 365 (Graph App)",
      from: email,
      project,
      status: graphAppReady ? "Connected" : "Not configured"
    }));

  let accounts = [...envAccounts, ...oauthPublic, ...dbPublic, ...dbPresetPublic, ...presetPublic];
  if ((project === "tec" || project === "tut") && presetEmails.length) {
    const allowed = new Set(presetEmails);
    accounts = accounts.filter((a) => allowed.has(String(a.from || "").toLowerCase()));
  }

  return NextResponse.json({ accounts });
}

export async function POST(req) {
  try {
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

    const created = await SenderAccount.create(account);
    return NextResponse.json({
      ok: true,
      account: {
        id: `db:${String(created._id)}`,
        provider: created.provider,
        label: created.label,
        from: created.from,
        status: 'Connected'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to add account' }, { status: 400 });
  }
}
