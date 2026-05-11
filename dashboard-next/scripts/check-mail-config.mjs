import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

function loadEnvFromFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function argValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function mask(value = '') {
  const text = String(value || '');
  if (!text) return 'missing';
  if (text.length <= 8) return 'set';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function projectGraphConfig(project = '') {
  const normalized = String(project || '').trim().toLowerCase();
  if (normalized === 'tut') {
    return {
      project: 'tut',
      tenantId: process.env.TUT_TENANT_ID || '',
      clientId: process.env.TUT_CLIENT_ID || '',
      clientSecret: process.env.TUT_CLIENT_SECRET || '',
      sender: process.env.TUT_GRAPH_SENDER_EMAIL || ''
    };
  }
  if (normalized === 'tec') {
    return {
      project: 'tec',
      tenantId: process.env.TEC_TENANT_ID || '',
      clientId: process.env.TEC_CLIENT_ID || '',
      clientSecret: process.env.TEC_CLIENT_SECRET || '',
      sender: process.env.TEC_GRAPH_SENDER_EMAIL || ''
    };
  }
  return {
    project: 'default',
    tenantId: process.env.TENANT_ID || process.env.MS_TENANT_ID || '',
    clientId: process.env.CLIENT_ID || process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.CLIENT_SECRET || process.env.MS_CLIENT_SECRET || '',
    sender: process.env.GRAPH_SENDER_EMAIL || ''
  };
}

async function getGraphToken(config) {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', config.clientId);
  params.set('client_secret', config.clientSecret);
  params.set('grant_type', 'client_credentials');
  params.set('scope', 'https://graph.microsoft.com/.default');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Graph token failed (${response.status})`);
  }
  return data.access_token;
}

async function checkGraph(project, explicitSender = '', sendTo = '') {
  const config = projectGraphConfig(project);
  const sender = explicitSender || config.sender;
  console.log('[graph-config]', {
    project: config.project,
    tenantId: mask(config.tenantId),
    clientId: mask(config.clientId),
    clientSecret: mask(config.clientSecret),
    sender: sender || 'missing',
    graphAppOnly: process.env.ENABLE_GRAPH_APP_ONLY || 'missing'
  });

  const missing = ['tenantId', 'clientId', 'clientSecret'].filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing Graph config: ${missing.join(', ')}`);
  }
  if (!sender) {
    throw new Error('Missing Graph sender email');
  }

  const token = await getGraphToken(config);
  console.log('[graph-token] ok');

  const userResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}?$select=id,mail,userPrincipalName,accountEnabled`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const userData = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok) {
    throw new Error(userData?.error?.message || `Graph sender lookup failed (${userResponse.status})`);
  }
  console.log('[graph-sender] ok', {
    mail: userData.mail || '',
    userPrincipalName: userData.userPrincipalName || '',
    accountEnabled: userData.accountEnabled
  });

  if (!sendTo) return;

  const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: `IntelliMailPilot production send test ${new Date().toISOString()}`,
        body: { contentType: 'Text', content: 'Production mail configuration test.' },
        toRecipients: [{ emailAddress: { address: sendTo } }]
      },
      saveToSentItems: true
    })
  });
  if (!sendResponse.ok) {
    const sendData = await sendResponse.json().catch(() => ({}));
    throw new Error(sendData?.error?.message || `Graph send failed (${sendResponse.status})`);
  }
  console.log('[graph-send] ok', { to: sendTo });
}

async function checkSmtp(sendTo = '') {
  console.log('[smtp-config]', {
    host: process.env.SMTP_HOST || 'missing',
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE || 'false',
    user: process.env.SMTP_USER || 'missing',
    pass: mask(process.env.SMTP_PASS || ''),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'missing'
  });

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Missing SMTP_HOST/SMTP_USER/SMTP_PASS');
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transport.verify();
  console.log('[smtp-verify] ok');

  if (!sendTo) return;
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: sendTo,
    subject: `IntelliMailPilot SMTP production send test ${new Date().toISOString()}`,
    text: 'Production SMTP configuration test.'
  });
  console.log('[smtp-send] ok', { to: sendTo, messageId: info.messageId || '' });
}

async function main() {
  loadEnvFromFile();
  const project = argValue('project', 'tec');
  const sender = argValue('sender', '');
  const sendTo = argValue('send-to', '');
  const provider = argValue('provider', hasFlag('smtp') ? 'smtp' : 'graph');

  if (provider === 'smtp') {
    await checkSmtp(sendTo);
  } else {
    await checkGraph(project, sender, sendTo);
  }
}

main().catch((error) => {
  console.error('[mail-check-failed]', error?.message || error);
  process.exit(1);
});
