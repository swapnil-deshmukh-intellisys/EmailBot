import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireUser } from '@/lib/apiAuth';

function normalizeEmail(raw) {
  let value = String(raw || '').trim();
  const mdMailto = value.match(/\]\(mailto:([^)]+)\)/i);
  if (mdMailto?.[1]) value = mdMailto[1].trim();
  value = value.replace(/^mailto:/i, '').trim();
  value = value.replace(/^[<[\("'`\s]+/, '').replace(/[>\])"'`\s]+$/, '');
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.includes(';')) value = value.split(';')[0].trim();
  return value;
}

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const list = await LeadList.findOne({ _id: params.id, userEmail });
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  let changed = 0;
  for (const lead of list.leads) {
    const before = String(lead.Email || '').trim();
    const after = normalizeEmail(before);
    if (before !== after) {
      lead.Email = after;
      changed += 1;
    }
  }

  await list.save();
  return NextResponse.json({ ok: true, listId: String(list._id), changed });
}
