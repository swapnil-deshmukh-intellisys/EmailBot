import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeProject(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw || 'unassigned';
}

function campaignProjectKey(campaign = {}) {
  return normalizeProject([
    campaign.project,
    campaign.projectId,
    campaign.projectName,
    campaign.senderFrom,
    campaign.senderAccount?.from,
    campaign.senderAccount?.user
  ].filter(Boolean).join(' '));
}

function listProjectKey(list = {}, campaignsByListId = new Map()) {
  const explicit = normalizeProject([
    list.project,
    list.projectId,
    list.projectName
  ].filter(Boolean).join(' '));
  if (explicit === 'tec' || explicit === 'tut') return explicit;

  const campaigns = campaignsByListId.get(String(list._id)) || [];
  const counts = campaigns.reduce((acc, campaign) => {
    const key = campaignProjectKey(campaign);
    if (key === 'tec' || key === 'tut') acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  if (counts.tec || counts.tut) {
    return Number(counts.tec || 0) >= Number(counts.tut || 0) ? 'tec' : 'tut';
  }

  const text = `${list.name || ''} ${list.sourceFile || ''} ${list.sourceFileName || ''}`;
  const fromListText = normalizeProject(text);
  return fromListText === 'tec' || fromListText === 'tut' ? fromListText : 'unassigned';
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    const [listDocs, campaignDocs, verifiedRows] = await Promise.all([
      LeadList.find(ownerQuery)
        .select('name sourceFile sourceFileName kind uploadedAt createdAt project projectId projectName leads')
        .sort({ uploadedAt: -1, createdAt: -1 })
        .lean(),
      Campaign.find(buildAuthOwnerFilter(auth))
        .select('listId project projectId projectName senderFrom senderAccount.from senderAccount.user createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      LeadList.aggregate([
        { $match: ownerQuery },
        { $unwind: { path: '$leads', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ['$leads.Email', ''] } }, 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);
    const campaignsByListId = campaignDocs.reduce((map, campaign) => {
      const listId = String(campaign?.listId || '');
      if (!listId) return map;
      if (!map.has(listId)) map.set(listId, []);
      map.get(listId).push(campaign);
      return map;
    }, new Map());
    const projectCounts = { tec: 0, tut: 0, unassigned: 0 };
    const listSummariesRaw = listDocs.map((list) => {
      const leadCount = Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData).length : 0;
      const project = listProjectKey(list, campaignsByListId);
      projectCounts[project] = Number(projectCounts[project] || 0) + leadCount;
      return {
        _id: list._id,
        name: list.name,
        sourceFile: list.sourceFile,
        kind: list.kind || 'uploaded',
        uploadedAt: list.uploadedAt || list.createdAt || null,
        leadCount,
        project
      };
    });
    const countedClients = listSummariesRaw.reduce((sum, list) => sum + Number(list.leadCount || 0), 0);
    const totalClients = countedClients || Number(verifiedRows[0]?.total || 0);
    const verifiedClients = Number(verifiedRows[0]?.verified || 0);
    const missingEmailClients = Math.max(0, totalClients - verifiedClients);
    const listSummaries = listSummariesRaw.map((list) => ({
      _id: String(list._id),
      name: list.name,
      sourceFile: list.sourceFile,
      kind: list.kind || 'uploaded',
      uploadedAt: list.uploadedAt || null,
      leadCount: Number(list.leadCount || 0),
      project: list.project,
      projectCounts: { [normalizeProject(list.project)]: Number(list.leadCount || 0) }
    }));

    return NextResponse.json({
      ok: true,
      totalClients,
      verifiedClients,
      missingEmailClients,
      activeLists: listSummaries.length,
      projectCounts: {
        tec: Number(projectCounts.tec || 0),
        tut: Number(projectCounts.tut || 0),
        total: totalClients
      },
      lists: listSummaries
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load client overview' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
