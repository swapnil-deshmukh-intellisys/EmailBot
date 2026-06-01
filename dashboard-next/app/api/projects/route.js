import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import Project from '@/models/Project';

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

    const projects = await Project.find().sort({ name: 1 });

    return NextResponse.json({
      success: true,
      projects
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch projects',
      projects: []
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
