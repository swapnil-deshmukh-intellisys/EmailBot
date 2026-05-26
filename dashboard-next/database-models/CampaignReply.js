import mongoose from 'mongoose';

const CampaignReplySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    leadListId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null, index: true },
    leadEmail: { type: String, default: '', index: true },
    accountId: { type: String, default: '', index: true },
    messageId: { type: String, required: true, index: true },
    conversationId: { type: String, default: '', index: true },
    fromEmail: { type: String, default: '', index: true },
    subject: { type: String, default: '' },
    bodyPreview: { type: String, default: '' },
    replyType: { type: String, enum: ['positive', 'negative', 'not_interested', 'follow_up', 'unread', 'unknown'], default: 'unknown', index: true },
    receivedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

CampaignReplySchema.index({ userEmail: 1, messageId: 1 }, { unique: true });
CampaignReplySchema.index({ userEmail: 1, replyType: 1, receivedAt: -1 });

export default mongoose.models.CampaignReply || mongoose.model('CampaignReply', CampaignReplySchema);
