import mongoose from 'mongoose';

const CampaignSentEmailSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    campaignName: { type: String, default: '' },
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailDraft', default: null, index: true },
    draftName: { type: String, default: '' },
    recipientLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignRecipientLog', default: null, index: true },
    recipientEmail: { type: String, default: '', index: true },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    senderId: { type: String, default: '' },
    senderEmail: { type: String, default: '', index: true },
    provider: { type: String, default: '' },
    project: { type: String, default: '' },
    messageId: { type: String, default: '', index: true },
    internetMessageId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    threadId: { type: String, default: '' },
    inReplyTo: { type: String, default: '' },
    references: { type: [String], default: [] },
    originalSubject: { type: String, default: '' },
    subject: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent', index: true },
    failureReason: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: 'campaign_sent_emails' }
);

CampaignSentEmailSchema.index({ campaignId: 1, recipientEmail: 1, sentAt: -1 });
CampaignSentEmailSchema.index({ userEmail: 1, campaignId: 1, sentAt: -1 });

export default mongoose.models.CampaignSentEmail || mongoose.model('CampaignSentEmail', CampaignSentEmailSchema);