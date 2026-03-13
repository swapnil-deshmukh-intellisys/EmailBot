import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import PresetSender from '../../../models/PresetSender';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(req) {
  try {
    await connectDB();
    const { email, project } = await req.json();
    const normalized = normalizeEmail(email);
    const proj = String(project || '').toLowerCase();

    if (!normalized) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!['tec', 'tut'].includes(proj)) {
      return NextResponse.json({ error: 'Project must be TEC or TUT' }, { status: 400 });
    }

    await PresetSender.updateOne(
      { email: normalized, project: proj },
      { $setOnInsert: { email: normalized, project: proj, createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, email: normalized, project: proj });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to save preset sender' }, { status: 500 });
  }
}
