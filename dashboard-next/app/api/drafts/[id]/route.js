import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import EmailDraft from '../../../../models/EmailDraft';

const ALLOWED_CATEGORIES = ['cover_story', 'reminder', 'follow_up', 'updated_cost', 'final_cost'];

export async function PATCH(req, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { category, title, subject, body } = await req.json();
    if (!category || !title || !subject || !body) {
      return NextResponse.json({ error: 'category, title, subject, and body are required' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    const draft = await EmailDraft.findByIdAndUpdate(
      id,
      { category, title, subject, body },
      { new: true, runValidators: true }
    ).lean();
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const draft = await EmailDraft.findByIdAndDelete(id);
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete draft' }, { status: 500 });
  }
}
