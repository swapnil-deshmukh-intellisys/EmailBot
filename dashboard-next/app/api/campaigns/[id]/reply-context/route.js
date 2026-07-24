import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import CampaignSentEmail from '@/models/CampaignSentEmail';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { resolveSenderAccountById } from '@/lib/senderAccounts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function jsonError(status, code, message) {
  return NextResponse.json(
    { success: false, ok: false, code, message, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const campaignId = String(params?.id || '').trim();
    if (!mongoose.isValidObjectId(campaignId)) {
      return jsonError(400, 'INVALID_CAMPAIGN_ID', 'Invalid campaign id.');
    }

    await connectDB();
    const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId })).lean();
    if (!campaign) {
      return jsonError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found for current user.');
    }

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();

    // 1. Resolve and Validate Sheet/List
    let list = null;
    let sheetMissing = false;
    let canReuseSheet = false;
    let recipients = [];
    let customSheetName = campaign.customSheetName || '';

    if (campaign.listId && mongoose.isValidObjectId(campaign.listId)) {
      list = await LeadList.findOne({ _id: campaign.listId }).lean();
    }

    // Load recipients from logs/sent emails as fallback or verification
    const recipientLogs = await CampaignRecipientLog.find({ campaignId: campaign._id }).lean();
    const sentEmails = await CampaignSentEmail.find({ campaignId: campaign._id }).lean();

    if (list) {
      canReuseSheet = true;
      customSheetName = list.name || customSheetName || `List ${list._id}`;
      recipients = Array.isArray(list.leads) ? list.leads.map((lead, idx) => ({
        id: lead.id || String(lead._id || idx),
        name: lead.Name || lead.name || '',
        email: lead.Email || lead.email || '',
        company: lead.Company || lead.company || '',
        designation: lead.Designation || lead.designation || '',
        sector: lead.Sector || lead.sector || '',
        country: lead.Country || lead.country || '',
        ...lead
      })) : [];
    } else {
      sheetMissing = true;
      canReuseSheet = false;
      // Fallback construction of recipients list from recipient logs
      if (recipientLogs.length > 0) {
        recipients = recipientLogs.map((log, idx) => ({
          id: String(log._id || idx),
          name: log.name || log.recipientEmail?.split('@')[0] || 'Recipient',
          email: log.recipientEmail || log.email || '',
          company: log.company || '',
          designation: log.designation || '',
          sector: log.sector || '',
          country: log.country || ''
        }));
      }
    }

    // 2. Resolve and Validate Sender
    const originalSenderId = campaign.senderAccountId || '';
    const originalSenderEmail = campaign.senderFrom || '';
    let canReuseSender = false;
    let senderActive = false;
    let resolvedAccount = null;

    if (originalSenderId) {
      resolvedAccount = await resolveSenderAccountById(originalSenderId, {
        userEmail,
        project: campaign.project || campaign.projectId || '',
        senderFrom: originalSenderEmail
      });
    }

    if (resolvedAccount) {
      const status = String(resolvedAccount.status || '').trim().toLowerCase();
      if (!resolvedAccount.status || ['connected', 'active', 'good', 'verified'].includes(status)) {
        senderActive = true;
        canReuseSender = true;
      }
    }

    // 3. Extract Thread Metadata
    // Look for any sent email that has conversation/thread details
    const threadEmail = sentEmails.find(
      (email) => email.conversationId || email.messageId || email.internetMessageId
    ) || sentEmails[0] || {};

    const threadMetadata = {
      messageId: threadEmail.messageId || '',
      internetMessageId: threadEmail.internetMessageId || '',
      conversationId: threadEmail.conversationId || '',
      threadId: threadEmail.threadId || '',
      references: Array.isArray(threadEmail.references) ? threadEmail.references : []
    };

    return NextResponse.json({
      success: true,
      ok: true,
      campaignId: campaign._id,
      originalCampaignName: campaign.name || '',
      project: campaign.project || campaign.projectName || campaign.projectId || '',
      projectId: campaign.projectId || campaign.project || '',
      listId: campaign.listId || '',
      sheetId: campaign.sheetId || campaign.listId || '',
      uploadedFileId: campaign.uploadedFileId || '',
      customSheetName,
      senderAccountId: originalSenderId,
      senderEmail: originalSenderEmail,
      draftId: campaign.draftId || '',
      subject: campaign.inlineTemplate?.subject || campaign.name || '',
      bodyHtml: campaign.inlineTemplate?.bodyHtml || campaign.inlineTemplate?.body || '',
      recipients,
      recipientLogs,
      sentEmailMetadata: sentEmails.map(e => ({
        messageId: e.messageId,
        internetMessageId: e.internetMessageId,
        conversationId: e.conversationId,
        recipientEmail: e.recipientEmail
      })),
      threadMetadata,
      canReuseSheet,
      canReuseSender,
      sheetMissing,
      senderActive
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('[api/campaigns/reply-context] Error:', error);
    return jsonError(500, 'REPLY_CONTEXT_FAILED', error.message || 'Failed to fetch reply context.');
  }
}
