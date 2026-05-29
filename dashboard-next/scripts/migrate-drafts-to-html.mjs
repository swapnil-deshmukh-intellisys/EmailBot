import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { htmlToText } from 'html-to-text';

dotenv.config({ path: '.env.local' });
dotenv.config();

const plainTextToHtml = (text = '') => String(text || '')
  .replace(/\r\n/g, '\n')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .split(/\n{2,}/)
  .map((block) => `<p>${block.replace(/\n/g, '<br>') || '<br>'}</p>`)
  .join('');

async function run() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Draft = mongoose.connection.collection('emaildrafts');
  
  const cursor = Draft.find({
    $or: [
      { bodyHtml: { $exists: false } },
      { bodyHtml: '' },
      { bodyHtml: null }
    ]
  });

  let migrated = 0;

  for await (const draft of cursor) {
    if (!draft.body) continue;
    
    // If body looks like HTML already, use it. Otherwise, convert to HTML.
    let isHtml = /<[a-z][\s\S]*>/i.test(draft.body);
    let newHtml = isHtml ? draft.body : plainTextToHtml(draft.body);
    let newText = htmlToText(newHtml, { wordwrap: 130 });

    await Draft.updateOne(
      { _id: draft._id },
      {
        $set: {
          bodyHtml: newHtml,
          bodyText: newText
        }
      }
    );
    migrated++;
    console.log(`Migrated draft: ${draft._id}`);
  }

  console.log(`Migration complete. Migrated ${migrated} drafts.`);
  process.exit(0);
}

run().catch(console.error);
