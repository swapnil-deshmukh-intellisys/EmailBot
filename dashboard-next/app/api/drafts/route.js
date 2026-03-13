import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import EmailDraft from '../../../models/EmailDraft';

const ALLOWED_CATEGORIES = ['cover_story', 'reminder', 'follow_up', 'updated_cost', 'final_cost'];

export async function GET() {
  try {
    await connectDB();
    const drafts = await EmailDraft.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ drafts });
  } catch (error) {
    return NextResponse.json({ drafts: [], error: error.message || 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const { category, title, subject, body } = await req.json();
    if (!category || !title || !subject || !body) {
      return NextResponse.json({ error: 'category, title, subject, and body are required' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    const draft = await EmailDraft.create({ category, title, subject, body });
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create draft' }, { status: 500 });
  }
}
