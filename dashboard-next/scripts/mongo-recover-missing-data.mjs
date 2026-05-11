import fs from 'fs';
import process from 'process';
import mongoose from 'mongoose';

const appRoot = process.cwd();
const applyChanges = process.argv.includes('--apply');
const sourceArg = process.argv.find((item) => item.startsWith('--source='));
const targetArg = process.argv.find((item) => item.startsWith('--target='));
const collectionsArg = process.argv.find((item) => item.startsWith('--collections='));
const sourceDbName = sourceArg ? sourceArg.slice('--source='.length).trim() : 'test';
const targetDbName = targetArg ? targetArg.slice('--target='.length).trim() : 'email-bot-dashboard';

const recoveryCollections = [
  'userprofiles',
  'signuprequests',
  'upgraderequests',
  'usersubscriptions',
  'credittransactions',
  'campaigns',
  'campaignrecipientlogs',
  'campaignrecipientclaims',
  'leadlists',
  'emailtemplates',
  'emaildrafts',
  'senderaccounts',
  'graphoauthaccounts',
  'presetsenders',
  'uploadfiles',
  'activitylogs',
  'emailthreads',
  'calendarevents',
  'warmupautoreplysettings',
  'warmupautoreplylogs'
];

const selectedCollections = collectionsArg
  ? collectionsArg
      .slice('--collections='.length)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  : recoveryCollections;

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function maskMongoUri(uri = '') {
  return String(uri || '').replace(/\/\/([^:@/]+):([^@/]+)@/, (_, user) => `//${user}:***@`);
}

async function collectionExists(db, collectionName) {
  const found = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();
  return found.length > 0;
}

async function getExistingIds(collection) {
  const docs = await collection.find({}, { projection: { _id: 1 } }).toArray();
  return new Set(docs.map((item) => String(item._id)));
}

async function recoverCollection({ sourceDb, targetDb, collectionName }) {
  const source = sourceDb.collection(collectionName);
  const target = targetDb.collection(collectionName);

  const exists = await collectionExists(sourceDb, collectionName);
  if (!exists) {
    return { collection: collectionName, sourceCount: 0, targetCountBefore: await target.countDocuments().catch(() => 0), missing: 0, inserted: 0, skipped: true };
  }

  const [sourceCount, targetCountBefore, existingIds] = await Promise.all([
    source.countDocuments(),
    target.countDocuments().catch(() => 0),
    getExistingIds(target).catch(() => new Set())
  ]);

  const missingDocs = [];
  const cursor = source.find({});
  for await (const doc of cursor) {
    if (!existingIds.has(String(doc._id))) {
      missingDocs.push(doc);
    }
  }

  let inserted = 0;
  if (applyChanges && missingDocs.length) {
    try {
      const result = await target.insertMany(missingDocs, { ordered: false });
      inserted = Object.keys(result.insertedIds || {}).length;
    } catch (error) {
      inserted = error?.result?.result?.nInserted || error?.insertedDocs?.length || 0;
      if (!/duplicate/i.test(String(error.message || ''))) {
        throw error;
      }
    }
  }

  const targetCountAfter = applyChanges ? await target.countDocuments() : targetCountBefore;
  return {
    collection: collectionName,
    sourceCount,
    targetCountBefore,
    missing: missingDocs.length,
    inserted,
    targetCountAfter
  };
}

async function main() {
  if (sourceDbName === targetDbName) {
    throw new Error('Source and target DB names must be different.');
  }

  const env = parseEnvFile(`${appRoot}/.env`);
  const mongoUri = process.env.MONGODB_URI || env.MONGODB_URI || '';
  if (!mongoUri) throw new Error('MONGODB_URI is not set.');

  console.log('[RECOVERY_MODE]', applyChanges ? 'APPLY' : 'DRY_RUN');
  console.log('[RECOVERY_SOURCE_DB]', sourceDbName);
  console.log('[RECOVERY_TARGET_DB]', targetDbName);
  console.log('[RECOVERY_COLLECTIONS]', selectedCollections.join(','));
  console.log('[RECOVERY_URI]', maskMongoUri(mongoUri));

  await mongoose.connect(mongoUri, {
    bufferCommands: false,
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000
  });

  const sourceDb = mongoose.connection.client.db(sourceDbName);
  const targetDb = mongoose.connection.client.db(targetDbName);
  const results = [];

  for (const collectionName of selectedCollections) {
    const result = await recoverCollection({ sourceDb, targetDb, collectionName });
    results.push(result);
    console.log('[RECOVERY_COLLECTION]', JSON.stringify(result));
  }

  const summary = results.reduce(
    (acc, item) => {
      acc.missing += Number(item.missing || 0);
      acc.inserted += Number(item.inserted || 0);
      return acc;
    },
    { mode: applyChanges ? 'apply' : 'dry-run', sourceDbName, targetDbName, missing: 0, inserted: 0 }
  );

  console.log('[RECOVERY_SUMMARY]');
  console.log(JSON.stringify(summary, null, 2));
  if (!applyChanges) {
    console.log('[RECOVERY_NOTE] Dry-run only. Re-run with --apply to copy missing documents. This script never deletes or overwrites existing documents.');
  }
}

main()
  .catch((error) => {
    console.error('[RECOVERY_ERROR]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });
