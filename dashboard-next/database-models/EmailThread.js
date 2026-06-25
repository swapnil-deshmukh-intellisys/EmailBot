import mongoose from 'mongoose';

const EmailThreadSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    recipientEmail: { type: String, required: true, index: true },
    senderKey: { type: String, required: true, index: true },
    messageId: { type: String, default: '' },
    internetMessageId: { type: String, default: '' },
    conversationId: { type: String, default: '' },
    threadId: { type: String, default: '' },
    inReplyTo: { type: String, default: '' },
    originalSubject: { type: String, default: '' },
    subject: { type: String, default: '' },
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    bcc: { type: [String], default: [] },
    senderId: { type: String, default: '' },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    draftId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailDraft', default: null, index: true },
    project: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    references: { type: [String], default: [] },
    provider: { type: String, default: '' },
    lastCampaignType: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

EmailThreadSchema.index({ userEmail: 1, recipientEmail: 1, senderKey: 1 }, { unique: true });

export default mongoose.models.EmailThread || mongoose.model('EmailThread', EmailThreadSchema);
