import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

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

function mask(value = '') {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return 'set';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function compactSenderAccount(account = {}) {
  if (!account || typeof account !== 'object') return null;
  return {
    provider: account.provider || '',
    label: account.label || '',
    from: account.from || '',
    user: account.user || '',
    host: account.host || '',
    tenantId: mask(account.tenantId),
    clientId: mask(account.clientId),
    clientSecret: mask(account.clientSecret)
  };
}

loadEnvFromFile();

const name = argValue('name');
const id = argValue('id');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is missing.');
  process.exit(1);
}

if (!name && !id) {
  console.error('Usage: node scripts/inspect-campaign-failure.mjs --name=aks');
  console.error('   or: node scripts/inspect-campaign-failure.mjs --id=<campaignId>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

try {
  const query = id
    ? { _id: new mongoose.Types.ObjectId(id) }
    : { name: { $regex: name, $options: 'i' } };

  const campaign = await mongoose.connection.db
    .collection('campaigns')
    .findOne(query, { sort: { createdAt: -1 } });

  if (!campaign) {
    console.log({ ok: false, error: 'Campaign not found.' });
    process.exit(0);
  }

  const recipientLogs = await mongoose.connection.db
    .collection('campaignrecipientlogs')
    .find({ campaignId: campaign._id })
    .sort({ lastActivityAt: -1, createdAt: -1 })
    .limit(12)
    .toArray();

  console.log(JSON.stringify({
    ok: true,
    campaign: {
      id: String(campaign._id),
      name: campaign.name || '',
      project: campaign.project || '',
      status: campaign.status || '',
      displayStatus: campaign.displayStatus || '',
      senderFrom: campaign.senderFrom || '',
      senderAccountId: campaign.senderAccountId || '',
      senderAccount: compactSenderAccount(campaign.senderAccount),
      stats: campaign.stats || {},
      totalRecipients: campaign.totalRecipients || 0,
      sentCount: campaign.sentCount || 0,
      pendingCount: campaign.pendingCount || 0,
      failedCount: campaign.failedCount || 0,
      failureReason: campaign.failureReason || '',
      lastError: campaign.lastError || '',
      lastRunError: campaign.lastRunError || '',
      queueReason: campaign.queueReason || '',
      workerStatus: campaign.workerStatus || '',
      logs: (campaign.logs || []).slice(-12).map((log) => ({
        at: log.at,
        level: log.level,
        message: log.message
      }))
    },
    recipientLogs: recipientLogs.map((log) => ({
      email: log.email || log.recipientEmail || '',
      status: log.status || '',
      failureReason: log.failureReason || '',
      bounceReason: log.bounceReason || '',
      provider: log.provider || log.stepLogs?.find((step) => step?.provider)?.provider || '',
      lastActivityAt: log.lastActivityAt || log.updatedAt || log.createdAt || null,
      stepLogs: (log.stepLogs || []).map((step) => ({
        stepNumber: step.stepNumber,
        status: step.status,
        failureReason: step.failureReason || '',
        provider: step.provider || ''
      }))
    }))
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
