import mongoose from 'mongoose';

const CampaignEmailReplySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailDraft', default: null, index: true },
    recipientLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignRecipientLog', default: null, index: true },
    parentMessageId: { type: String, default: '', index: true },
    parentInternetMessageId: { type: String, default: '', index: true },
    messageId: { type: String, default: '', index: true },
    internetMessageId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    threadId: { type: String, default: '' },
    inReplyTo: { type: String, default: '' },
    references: { type: [String], default: [] },
    originalSubject: { type: String, default: '' },
    subject: { type: String, default: '' },
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    senderId: { type: String, default: '' },
    senderEmail: { type: String, default: '', index: true },
    provider: { type: String, default: '' },
    project: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    type: { type: String, enum: ['reply', 'reply_all', 'reminder'], default: 'reply', index: true },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent', index: true },
    failureReason: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true, collection: 'campaign_email_replies' }
);

CampaignEmailReplySchema.index({ campaignId: 1, recipientLogId: 1, sentAt: -1 });
CampaignEmailReplySchema.index({ userEmail: 1, campaignId: 1, sentAt: -1 });

export default mongoose.models.CampaignEmailReply || mongoose.model('CampaignEmailReply', CampaignEmailReplySchema);