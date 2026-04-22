import connectDB from './mongodb.js';
import SenderAccount from '../models/SenderAccount.js';
import GraphOAuthAccount from '../models/GraphOAuthAccount.js';

const DEFAULT_PROJECT_PRESET_SENDERS = {
  tec: [
    'lily@theentrepreneurialchronicle.com',
    'charlie@theentrepreneurialchronicle.com',
    'robert@theentrepreneurialchronicle.com',
    'mark@theentrepreneurialchronicle.com',
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
    'olivia@theunicorntimes.com'
  ]
};

function parsePresetSenderEmails(raw = '') {
  return String(raw || '')
    .trim()
    .split(/[,\n\r]+/g)
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export function getPresetSenderEmails(project = '') {
  const normalizedProject = String(project || '').trim().toLowerCase();
  if (normalizedProject === 'tut') {
    const configured = parsePresetSenderEmails(
      process.env.PRESET_SENDER_EMAILS_TUT || ''
    );
    return configured.length ? configured : DEFAULT_PROJECT_PRESET_SENDERS.tut;
  }
  if (normalizedProject === 'tec') {
    const configured = parsePresetSenderEmails(
      process.env.PRESET_SENDER_EMAILS_TEC || ''
    );
    return configured.length ? configured : DEFAULT_PROJECT_PRESET_SENDERS.tec;
  }
  return parsePresetSenderEmails(process.env.PRESET_SENDER_EMAILS || process.env.SENDER_EMAILS || '');
}

export function getProjectGraphConfig(project = '') {
  const normalizedProject = String(project || '').trim().toLowerCase();
  if (normalizedProject === 'tut') {
    return {
      project: 'tut',
      tenantId: process.env.TUT_TENANT_ID || '',
      clientId: process.env.TUT_CLIENT_ID || '',
      clientSecret: process.env.TUT_CLIENT_SECRET || '',
      defaultFrom: process.env.TUT_GRAPH_SENDER_EMAIL || ''
    };
  }
  if (normalizedProject === 'tec') {
    return {
      project: 'tec',
      tenantId: process.env.TEC_TENANT_ID || '',
      clientId: process.env.TEC_CLIENT_ID || '',
      clientSecret: process.env.TEC_CLIENT_SECRET || '',
      defaultFrom: process.env.TEC_GRAPH_SENDER_EMAIL || ''
    };
  }
  return {
    project: '',
    tenantId: process.env.TENANT_ID || '',
    clientId: process.env.CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || '',
    defaultFrom: process.env.GRAPH_SENDER_EMAIL || ''
  };
}

function inferProjectFromEmail(email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return '';
  if (getPresetSenderEmails('tut').includes(normalizedEmail)) return 'tut';
  if (getPresetSenderEmails('tec').includes(normalizedEmail)) return 'tec';
  return '';
}

export function getRuntimeSenderAccounts(project = '') {
  const accounts = [];
  const graphConfig = getProjectGraphConfig(project);

  if (graphConfig.tenantId && graphConfig.clientId && graphConfig.clientSecret) {
    const defaultFrom = String(graphConfig.defaultFrom || '').trim();
    if (defaultFrom) {
      accounts.push({
        id: 'outlook-graph',
        provider: 'graph',
        label: 'Outlook / Microsoft 365 (Graph App)',
        from: defaultFrom,
        tenantId: graphConfig.tenantId,
        clientId: graphConfig.clientId,
        clientSecret: graphConfig.clientSecret
      });
    }

    for (const email of getPresetSenderEmails(project)) {
      if (!email) continue;
      if (email === defaultFrom.toLowerCase()) continue;
      accounts.push({
        id: `graphapp:${email}`,
        provider: 'graph',
        label: 'Outlook / Microsoft 365 (Graph App)',
        from: email,
        tenantId: graphConfig.tenantId,
        clientId: graphConfig.clientId,
        clientSecret: graphConfig.clientSecret
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

export async function resolveSenderAccountById(id, options = {}) {
  const raw = String(id || '').trim();
  const userEmail = String(options?.userEmail || '').trim().toLowerCase();
  const project = String(options?.project || '').trim().toLowerCase();
  if (!raw) return null;

  if (raw.startsWith('oauth:')) {
    const oauthId = raw.slice(6);
    if (!oauthId) return null;
    await connectDB();
    const query = userEmail ? { _id: oauthId, userEmail } : { _id: oauthId };
    const doc = await GraphOAuthAccount.findOne(query).lean();
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

  if (raw.startsWith('graphapp:')) {
    const email = raw.slice('graphapp:'.length).trim().toLowerCase();
    if (!email) return null;
    const graphConfig = getProjectGraphConfig(project || inferProjectFromEmail(email));
    if (!graphConfig.tenantId || !graphConfig.clientId || !graphConfig.clientSecret) return null;
    return {
      id: `graphapp:${email}`,
      provider: 'graph',
      label: 'Outlook / Microsoft 365 (Graph App)',
      from: email,
      tenantId: graphConfig.tenantId,
      clientId: graphConfig.clientId,
      clientSecret: graphConfig.clientSecret
    };
  }

  if (raw.startsWith('db:')) {
    const dbId = raw.slice(3);
    if (!dbId) return null;
    await connectDB();
    const query = userEmail ? { _id: dbId, userEmail } : { _id: dbId };
    const doc = await SenderAccount.findOne(query).lean();
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

  return getRuntimeSenderAccounts(project).find((a) => a.id === raw) || null;
}
