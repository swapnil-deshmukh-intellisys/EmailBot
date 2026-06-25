import mongoose from 'mongoose';

const StepLogSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, default: 1 },
    subject: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
    sentAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    skippedAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },
    messageId: { type: String, default: '' },
    internetMessageId: { type: String, default: '' },
    conversationId: { type: String, default: '' },
    provider: { type: String, default: '' },
    trackingId: { type: String, default: '' }
  },
  { _id: false }
);

const CampaignRecipientLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    campaignName: { type: String, default: '' },
    projectId: { type: String, default: '' },
    projectName: { type: String, default: '' },
    recipientId: { type: String, default: '' },
    recipientEmail: { type: String, default: '' },
    recipientName: { type: String, default: '' },
    clientName: { type: String, default: '' },
    email: { type: String, required: true, index: true },
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    status: { type: String, default: 'Pending', index: true },
    currentStep: { type: Number, default: 1 },
    totalSteps: { type: Number, default: 5 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    openCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    firstOpenedAt: { type: Date, default: null },
    lastReplyAt: { type: Date, default: null },
    replyReceived: { type: Boolean, default: false, index: true },
    replyType: { type: String, default: '' },
    replyPreview: { type: String, default: '' },
    followUpStopped: { type: Boolean, default: false },
    followUpStopReason: { type: String, default: '' },
    reminderSentCount: { type: Number, default: 0 },
    manualReplySentCount: { type: Number, default: 0 },
    replyAllSentCount: { type: Number, default: 0 },
    lastFollowUpAt: { type: Date, default: null },
    threadStatus: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    bounceReason: { type: String, default: '' },
    dnc: { type: Boolean, default: false },
    unsubscribe: { type: Boolean, default: false },
    stepLogs: { type: [StepLogSchema], default: [] },
    notes: { type: String, default: '' },
    lastActivityAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

CampaignRecipientLogSchema.index({ campaignId: 1, email: 1 }, { unique: true });
CampaignRecipientLogSchema.index({ userId: 1, campaignId: 1 });
CampaignRecipientLogSchema.index({ userEmail: 1, campaignId: 1 });
CampaignRecipientLogSchema.index({ campaignId: 1, status: 1, lastActivityAt: -1 });
CampaignRecipientLogSchema.index({ campaignId: 1, updatedAt: -1 });
CampaignRecipientLogSchema.index({ userId: 1, updatedAt: -1 });
CampaignRecipientLogSchema.index({ userEmail: 1, updatedAt: -1 });
CampaignRecipientLogSchema.index({ campaignId: 1, recipientEmail: 1 });
CampaignRecipientLogSchema.index({ 'stepLogs.trackingId': 1 });
CampaignRecipientLogSchema.index({ trackingId: 1 });

export default mongoose.models.CampaignRecipientLog || mongoose.model('CampaignRecipientLog', CampaignRecipientLogSchema);
