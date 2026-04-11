import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { requireUser } from '@/lib/apiAuth';

export async function DELETE(req, { params }) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();

    const id = String(params?.id || '');
    if (!id) {
      return NextResponse.json({ error: 'Account id is required' }, { status: 400 });
    }

    if (id.startsWith('db:')) {
      const recordId = id.slice(3);
      await SenderAccount.findOneAndDelete({ _id: recordId, userEmail });
      return NextResponse.json({ ok: true, removed: id });
    }

    if (id.startsWith('oauth:')) {
      const recordId = id.slice(6);
      await GraphOAuthAccount.findOneAndDelete({ _id: recordId, userEmail });
      return NextResponse.json({ ok: true, removed: id });
    }

    return NextResponse.json({ error: 'Unsupported account type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to disconnect account' }, { status: 400 });
  }
}
