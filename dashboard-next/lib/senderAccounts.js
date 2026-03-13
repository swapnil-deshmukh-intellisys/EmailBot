import connectDB from './mongodb';
import SenderAccount from '../models/SenderAccount';
import GraphOAuthAccount from '../models/GraphOAuthAccount';

function getPresetSenderEmails() {
  const raw = String(process.env.PRESET_SENDER_EMAILS || process.env.SENDER_EMAILS || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\,\n\r]+/g)
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export function getRuntimeSenderAccounts() {
  const accounts = [];

  if (process.env.TENANT_ID && process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
    const defaultFrom = String(process.env.GRAPH_SENDER_EMAIL || "").trim();
    if (defaultFrom) {
      accounts.push({
        id: 'outlook-graph',
        provider: 'graph',
        label: 'Outlook / Microsoft 365 (Graph App)',
        from: defaultFrom,
        tenantId: process.env.TENANT_ID,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET
      });
    }

    // App-only: allow selecting any sender email (no per-mailbox sign-in) when PRESET_SENDER_EMAILS is set.
    const preset = getPresetSenderEmails();
    for (const email of preset) {
      if (!email) continue;
      if (email === String(process.env.GRAPH_SENDER_EMAIL || "").trim().toLowerCase()) continue;
      accounts.push({
        id: `graphapp:${email}`,
        provider: "graph",
        label: "Outlook / Microsoft 365 (Graph App)",
        from: email,
        tenantId: process.env.TENANT_ID,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET
      });
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const host = process.env.SMTP_HOST || '';
    const isGmail = host.toLowerCase().includes('gmail') || process.env.SMTP_USER.toLowerCase().endsWith('@gmail.com');
    accounts.push({
      id: isGmail ? 'gmail-smtp' : 'smtp-default',
      provider: isGmail ? 'gmail' : 'smtp',
      label: isGmail ? 'Gmail' : 'Custom SMTP',
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      host: isGmail ? 'smtp.gmail.com' : host,
      port: Number(isGmail ? 465 : (process.env.SMTP_PORT || 587)),
      secure: isGmail ? true : String(process.env.SMTP_SECURE || 'false') === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    });
  }

  return accounts;
}

export async function resolveSenderAccountById(id) {
  const raw = String(id || '').trim();
  if (!raw) return null;

  if (raw.startsWith('oauth:')) {
    const oauthId = raw.slice(6);
    if (!oauthId) return null;
    await connectDB();
    const doc = await GraphOAuthAccount.findById(oauthId).lean();
    if (!doc) return null;

    return {
      id: `oauth:${String(doc._id)}`,
      provider: 'graph_oauth',
      label: 'Outlook / Microsoft 365',
      from: doc.email,
      oauthAccountId: String(doc._id),
      tenantId: doc.tenantId
    };
  }


  if (raw.startsWith("graphapp:")) {
    const email = raw.slice("graphapp:".length).trim().toLowerCase();
    if (!email) return null;
    if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET) return null;
    return {
      id: `graphapp:${email}`,
      provider: "graph",
      label: "Outlook / Microsoft 365 (Graph App)",
      from: email,
      tenantId: process.env.TENANT_ID,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET
    };
  }

  if (raw.startsWith('db:')) {
    const dbId = raw.slice(3);
    if (!dbId) return null;
    await connectDB();
    const doc = await SenderAccount.findById(dbId).lean();
    if (!doc) return null;

    return {
      id: `db:${String(doc._id)}`,
      provider: doc.provider,
      label: doc.label,
      from: doc.from,
      host: doc.host,
      port: Number(doc.port || 587),
      secure: Boolean(doc.secure),
      user: doc.user,
      pass: doc.pass,
      tenantId: doc.tenantId,
      clientId: doc.clientId,
      clientSecret: doc.clientSecret
    };
  }

  return getRuntimeSenderAccounts().find((a) => a.id === raw) || null;
}
