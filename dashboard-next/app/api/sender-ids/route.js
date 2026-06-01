import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import Project from '@/models/Project';
import SenderId from '@/models/SenderId';
import SenderAccount from '@/models/SenderAccount';
import { encryptString } from '@/lib/tokenCrypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

async function seedProjects() {
  const defaultProjects = [
    { name: 'TEC', code: 'tec' },
    { name: 'TUT', code: 'tut' }
  ];
  for (const p of defaultProjects) {
    await Project.findOneAndUpdate(
      { code: p.code },
      { name: p.name, code: p.code },
      { upsert: true, new: true }
    );
  }
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    await seedProjects();

    const currentUserId = auth.currentUser._id;
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({
        success: false,
        message: "Project ID is required",
        senderIds: []
      }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const isAdmin = auth.currentUser.role === 'admin' || auth.currentUser.role === 'super_admin';
    const adminMode = url.searchParams.get('adminMode') === 'true';

    const query = { projectId };
    if (!isAdmin || !adminMode) {
      query.userId = currentUserId;
    }

    const senderIds = await SenderId.find(query).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      senderIds
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch sender IDs',
      senderIds: []
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    await seedProjects();

    const currentUserId = auth.currentUser._id;
    const body = await req.json();

    if (!body.name || !body.email || !body.password || !body.provider || !body.projectId || !body.projectName) {
      return NextResponse.json({
        success: false,
        message: "Missing required fields"
      }, { status: 400 });
    }

    const selectedProject = await Project.findById(body.projectId);
    if (!selectedProject) {
      return NextResponse.json({
        success: false,
        message: "Selected project not found"
      }, { status: 404 });
    }

    const emailStr = body.email.toLowerCase().trim();
    const providerLower = String(body.provider).toLowerCase();

    // 1. Save in SenderId collection as requested by schema verification
    const senderId = await SenderId.create({
      userId: currentUserId,
      name: body.name,
      email: emailStr,
      password: encryptString(body.password),
      provider: body.provider,
      projectId: body.projectId,
      projectName: body.projectName,
      status: "active",
      healthStatus: "unchecked"
    });

    // 2. Set SMTP details to bypass Azure AD OAuth / Google OAuth and use App Passwords
    let host = '';
    let port = 587;
    let secure = false;

    if (providerLower === 'gmail') {
      host = 'smtp.gmail.com';
      port = 465;
      secure = true;
    } else if (providerLower === 'outlook') {
      host = 'smtp.office365.com';
      port = 587;
      secure = false;
    } else { // SMTP
      const domain = emailStr.split('@')[1] || '';
      host = domain ? `smtp.${domain}` : '';
      port = 587;
      secure = false;
    }

    // 3. Save matching SMTP record in SenderAccount collection so the campaign runner resolves it
    await SenderAccount.create({
      _id: senderId._id, // Share the same ObjectId!
      userId: currentUserId,
      userEmail: String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase(),
      provider: providerLower === 'outlook' ? 'smtp' : (providerLower === 'gmail' ? 'gmail' : 'smtp'),
      label: body.name,
      from: emailStr,
      host,
      port,
      secure,
      user: emailStr,
      pass: body.password, // Raw password needed by nodemailer (will be used by SMTP transporter)
      projectId: selectedProject._id,
      projectName: selectedProject.name,
      project: String(selectedProject.code || '').toLowerCase(),
      status: 'Connected',
      health: 'Good'
    });

    return NextResponse.json({
      success: true,
      senderId,
      message: "Sender ID added successfully"
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to create sender ID'
    }, { status: 500 });
  }
}
