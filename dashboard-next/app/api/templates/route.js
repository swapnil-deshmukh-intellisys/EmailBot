import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailTemplate from '@/models/EmailTemplate';
import { requireUser } from '@/lib/apiAuth';

async function ensureDefaultTemplate(userEmail) {
  const count = await EmailTemplate.countDocuments({ userEmail });
  if (count > 0) return;

  await EmailTemplate.create({
    userEmail,
    name: 'Customize Draft',
    subject: 'Opportunity for {{Name}} at {{Company}}',
    body: '<p>Hello {{Name}},</p><p>We would like to share an opportunity with {{Company}}.</p><p>Regards,<br/>Team</p>'
  });
}

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    await ensureDefaultTemplate(userEmail);

    const templates = await EmailTemplate.find({ userEmail }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json({ templates: [], error: error.message || 'Failed to load templates' });
  }
}

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const { name, subject, body } = await req.json();

    if (!name || !subject || !body) {
      return NextResponse.json({ error: 'name, subject, body are required' }, { status: 400 });
    }

    const template = await EmailTemplate.create({ userEmail, name, subject, body });
    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
  }
}
