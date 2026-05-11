import fs from 'fs';
import path from 'path';
import process from 'process';
import mongoose from 'mongoose';

const appRoot = process.cwd();
const showEmails = process.argv.includes('--show-emails');
const includeSamples = process.argv.includes('--samples') || showEmails;
const dbArg = process.argv.find((item) => item.startsWith('--db='));
const requestedDbName = dbArg ? dbArg.slice('--db='.length).trim() : '';

const majorCollections = [
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

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function findEnvFiles() {
  const names = fs.readdirSync(appRoot);
  return names
    .filter((name) => name === '.env' || name === '.env.local' || name === '.env.production' || name === '.env.save' || name.startsWith('.env.backup'))
    .map((name) => path.join(appRoot, name))
    .sort();
}

function parseMongoUri(raw = '') {
  const uri = String(raw || '').trim();
  if (!uri) return null;
  try {
    const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const atIndex = withoutScheme.indexOf('@');
    const withoutCreds = atIndex >= 0 ? withoutScheme.slice(atIndex + 1) : withoutScheme;
    const [hostPart, rest = ''] = withoutCreds.split(/\/(.+)?/);
    const [pathPart = '', queryPart = ''] = rest.split('?');
    const params = new URLSearchParams(queryPart);
    const pathnameDb = decodeURIComponent(pathPart.replace(/^\//, '') || '');
    return {
      scheme: uri.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb',
      host: hostPart,
      dbName: pathnameDb || '(default: test)',
      authSource: params.get('authSource') || '',
      appName: params.get('appName') || '',
      masked: uri.replace(/\/\/([^:@/]+):([^@/]+)@/, (_, user) => `//${user}:***@`)
    };
  } catch (error) {
    return {
      parseError: error.message,
      masked: uri.replace(/\/\/([^:@/]+):([^@/]+)@/, (_, user) => `//${user}:***@`)
    };
  }
}

function maskEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  if (!email.includes('@') || showEmails) return email;
  const [local, domain] = email.split('@');
  const safeLocal = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${safeLocal}@${domain}`;
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

async function safeCount(db, collectionName, filter = {}) {
  try {
    return await db.collection(collectionName).countDocuments(filter);
  } catch (error) {
    return { error: error.message };
  }
}

async function distinctEmails(db, collectionName, fieldName) {
  try {
    const values = await db.collection(collectionName).distinct(fieldName);
    return values.map(normalizeEmail).filter(Boolean).sort();
  } catch {
    return [];
  }
}

async function main() {
  const envFiles = findEnvFiles();
  const envReport = envFiles.map((filePath) => {
    const env = parseEnvFile(filePath);
    const mongo = parseMongoUri(env.MONGODB_URI || '');
    return {
      file: path.relative(appRoot, filePath),
      hasMongoUri: Boolean(env.MONGODB_URI),
      mongo
    };
  });

  const activeEnv = parseEnvFile(path.join(appRoot, '.env'));
  const mongoUri = process.env.MONGODB_URI || activeEnv.MONGODB_URI || '';
  const activeMongo = parseMongoUri(mongoUri);

  console.log('[ENV_MONGODB_REPORT]');
  console.log(JSON.stringify(envReport, null, 2));

  if (!mongoUri) {
    console.log('[STOP] No MONGODB_URI found in process.env or dashboard-next/.env');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(mongoUri, {
    bufferCommands: false,
    maxPoolSize: 3,
    serverSelectionTimeoutMS: 10000
  });

  const connectedDb = mongoose.connection.db;
  const db = requestedDbName ? mongoose.connection.client.db(requestedDbName) : connectedDb;
  const admin = db.admin();
  const currentDbName = db.databaseName;

  let databases = [];
  try {
    const listed = await admin.listDatabases();
    databases = listed.databases
      .map((item) => ({ name: item.name, sizeOnDisk: item.sizeOnDisk, empty: item.empty }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    databases = [{ error: `listDatabases not permitted: ${error.message}` }];
  }

  const collections = await db.listCollections().toArray();
  const existingCollectionNames = new Set(collections.map((item) => item.name));
  const collectionNames = Array.from(new Set([...majorCollections, ...collections.map((item) => item.name)])).sort();
  const counts = {};
  for (const collectionName of collectionNames) {
    counts[collectionName] = existingCollectionNames.has(collectionName)
      ? await safeCount(db, collectionName)
      : 0;
  }

  const userEmails = Array.from(new Set([
    ...(await distinctEmails(db, 'userprofiles', 'email')),
    ...(await distinctEmails(db, 'userprofiles', 'identifier')),
    ...(await distinctEmails(db, 'userprofiles', 'intellisysUserId'))
  ])).filter(Boolean).sort();

  const dataOwnerCollections = [
    ['campaigns', 'userEmail'],
    ['leadlists', 'userEmail'],
    ['emailtemplates', 'userEmail'],
    ['emaildrafts', 'userEmail'],
    ['senderaccounts', 'userEmail'],
    ['graphoauthaccounts', 'userEmail'],
    ['uploadfiles', 'userEmail'],
    ['activitylogs', 'userEmail'],
    ['calendarevents', 'userEmail']
  ];

  const ownership = {};
  for (const [collectionName, fieldName] of dataOwnerCollections) {
    const emails = await distinctEmails(db, collectionName, fieldName);
    ownership[collectionName] = {
      totalEmails: emails.length,
      emails: includeSamples ? emails.map(maskEmail) : emails.slice(0, 10).map(maskEmail),
      extraDataEmailsNotInProfiles: emails.filter((email) => !userEmails.includes(email)).map(maskEmail),
      profileEmailsWithoutDataHere: userEmails.filter((email) => !emails.includes(email)).map(maskEmail)
    };
  }

  const sampleQueries = {};
  if (includeSamples) {
    for (const collectionName of ['userprofiles', 'campaigns', 'leadlists', 'emailtemplates', 'emaildrafts', 'senderaccounts', 'graphoauthaccounts']) {
      if (!existingCollectionNames.has(collectionName)) continue;
      sampleQueries[collectionName] = await db.collection(collectionName)
        .find({}, { projection: { passwordHash: 0, password: 0, accessToken: 0, refreshToken: 0, token: 0 } })
        .sort({ createdAt: -1, _id: -1 })
        .limit(5)
        .toArray();
    }
  }

  console.log('[CURRENT_CONNECTION]');
  console.log(JSON.stringify({
    currentDbName,
    connectedDefaultDbName: connectedDb.databaseName,
    inspectedDbName: currentDbName,
    host: activeMongo?.host || '',
    dbFromUri: activeMongo?.dbName || '',
    authSource: activeMongo?.authSource || '',
    appName: activeMongo?.appName || ''
  }, null, 2));

  console.log('[AVAILABLE_DATABASES]');
  console.log(JSON.stringify(databases, null, 2));

  console.log('[COLLECTION_COUNTS]');
  console.log(JSON.stringify(counts, null, 2));

  console.log('[USER_EMAIL_OWNERSHIP_CHECK]');
  console.log(JSON.stringify({
    profileEmails: userEmails.map(maskEmail),
    ownership
  }, null, 2));

  if (includeSamples) {
    console.log('[SAMPLES]');
    console.log(JSON.stringify(sampleQueries, null, 2));
  }
}

main()
  .catch((error) => {
    console.error('[MONGO_FORENSICS_ERROR]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });
