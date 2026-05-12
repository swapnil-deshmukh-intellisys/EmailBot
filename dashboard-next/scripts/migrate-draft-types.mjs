import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import EmailDraft from '../database-models/EmailDraft.js';

function inferLegacyDraftType(draft = {}) {
  const text = `${draft.title || ''} ${draft.subject || ''}`.toLowerCase();
  if (text.includes('cover story')) return 'cover_story';
  if (text.includes('reminder')) return 'reminder';
  if (text.includes('open follow')) return 'open_followup';
  if (text.includes('updated cost')) return 'updated_cost';
  if (text.includes('final follow') || text.includes('final cost')) return 'final_cost';
  if (text.includes('follow-up') || text.includes('follow up') || text.includes('followup')) return 'followup';
  return 'initial_outreach';
}

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

loadEnvFromFile();

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const drafts = await EmailDraft.find({}).lean();
let updated = 0;

for (const draft of drafts) {
  const draftType = inferLegacyDraftType(draft);
  if (draft.draftType === draftType && draft.category === draftType) continue;

  await EmailDraft.updateOne(
    { _id: draft._id },
    {
      $set: {
        draftType,
        category: draftType
      }
    }
  );
  updated += 1;
}

await mongoose.disconnect();

console.log(JSON.stringify({
  ok: true,
  checked: drafts.length,
  updated
}, null, 2));
