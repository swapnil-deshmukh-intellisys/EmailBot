const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const applyChanges = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run') || !applyChanges;

const COLLECTIONS = [
  'campaigns',
  'leadlists',
  'emaildrafts',
  'emailtemplates',
  'senderaccounts',
  'graphoauthaccounts',
  'credittransactions',
  'usersubscriptions',
  'emailthreads',
  'campaignrecipientlogs'
];

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function stringId(value) {
  return value ? String(value) : '';
}

function collectEmailHints(doc = {}) {
  return [
    doc.userEmail,
    doc.email,
    doc.uploadedByEmail,
    doc.createdByEmail,
    doc.ownerEmail,
    doc.senderFrom,
    doc.from,
    doc.recipientEmail
  ].map(normalizeEmail).filter(Boolean);
}

function collectIdHints(doc = {}) {
  return [
    doc.userId,
    doc.ownerId,
    doc.createdBy,
    doc.intellisysUserId,
    doc.employeeId
  ].map(stringId).filter(Boolean);
}

async function buildUserIndexes(db) {
  const users = await db.collection('userprofiles').find({}).project({
    _id: 1,
    email: 1,
    identifier: 1,
    username: 1,
    employeeId: 1,
    intellisysUserId: 1
  }).toArray();

  const byEmail = new Map();
  const byId = new Map();
  for (const user of users) {
    byId.set(String(user._id), user);
    for (const key of ['email', 'identifier', 'username', 'employeeId', 'intellisysUserId']) {
      const value = normalizeEmail(user[key]);
      if (value) byEmail.set(value, user);
    }
  }
  return { users, byEmail, byId };
}

async function buildCampaignOwnerIndex(db) {
  const campaigns = await db.collection('campaigns').find({}).project({ _id: 1, userId: 1, userEmail: 1 }).toArray();
  const out = new Map();
  for (const campaign of campaigns) {
    out.set(String(campaign._id), {
      userId: campaign.userId || null,
      userEmail: normalizeEmail(campaign.userEmail)
    });
  }
  return out;
}

function resolveOwner({ doc, users, campaignOwners }) {
  for (const id of collectIdHints(doc)) {
    const user = users.byId.get(id);
    if (user) return { user, reason: `matched id ${id}` };
  }

  for (const email of collectEmailHints(doc)) {
    const user = users.byEmail.get(email);
    if (user) return { user, reason: `matched email ${email}` };
  }

  const campaignOwner = doc.campaignId ? campaignOwners.get(String(doc.campaignId)) : null;
  if (campaignOwner?.userId || campaignOwner?.userEmail) {
    const user = campaignOwner.userId
      ? users.byId.get(String(campaignOwner.userId))
      : users.byEmail.get(normalizeEmail(campaignOwner.userEmail));
    if (user) return { user, reason: `matched campaign ${doc.campaignId}` };
  }

  return null;
}

function buildOwnerUpdate(doc, user) {
  const userEmail = normalizeEmail(user.email || user.identifier || user.username || '');
  const update = {};
  if (!doc.userId && user._id) update.userId = user._id;
  if (!normalizeEmail(doc.userEmail) && userEmail) update.userEmail = userEmail;
  return update;
}

async function backfillCollection(db, collectionName, users, campaignOwners) {
  const collection = db.collection(collectionName);
  const exists = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  if (!exists.length) return { collection: collectionName, scanned: 0, matched: 0, updated: 0, unknown: 0, unknownSamples: [] };

  const cursor = collection.find({});
  const operations = [];
  const unknownSamples = [];
  let scanned = 0;
  let matched = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const owner = resolveOwner({ doc, users, campaignOwners });
    if (!owner) {
      if (unknownSamples.length < 20) {
        unknownSamples.push({ _id: String(doc._id), name: doc.name || doc.title || '', userEmail: doc.userEmail || '', email: doc.email || '' });
      }
      continue;
    }

    matched += 1;
    const $set = buildOwnerUpdate(doc, owner.user);
    if (!Object.keys($set).length) continue;
    operations.push({ updateOne: { filter: { _id: doc._id }, update: { $set } } });
  }

  let updated = 0;
  if (applyChanges && operations.length) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    updated = result.modifiedCount || 0;
  }

  return {
    collection: collectionName,
    scanned,
    matched,
    pendingUpdates: operations.length,
    updated,
    unknown: scanned - matched,
    unknownSamples
  };
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const users = await buildUserIndexes(db);
  const campaignOwners = await buildCampaignOwnerIndex(db);

  console.log(`[OWNER_BACKFILL_MODE] ${dryRun ? 'DRY_RUN' : 'APPLY'}`);
  const results = [];
  for (const collectionName of COLLECTIONS) {
    const result = await backfillCollection(db, collectionName, users, campaignOwners);
    results.push(result);
    console.log('[OWNER_BACKFILL_COLLECTION]', JSON.stringify(result));
  }
  console.log('[OWNER_BACKFILL_SUMMARY]');
  console.log(JSON.stringify({
    mode: dryRun ? 'dry-run' : 'apply',
    pendingUpdates: results.reduce((sum, item) => sum + Number(item.pendingUpdates || 0), 0),
    updated: results.reduce((sum, item) => sum + Number(item.updated || 0), 0),
    unknown: results.reduce((sum, item) => sum + Number(item.unknown || 0), 0)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[OWNER_BACKFILL_ERROR]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
  });
