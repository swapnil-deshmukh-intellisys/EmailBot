import mongoose from 'mongoose';

const MailDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    accountId: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    provider: { type: String, default: 'outlook' },
    graphMessageId: { type: String, default: '', index: true },
    toEmails: { type: [String], default: [] },
    ccEmails: { type: [String], default: [] },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'approved', 'sent', 'deleted'], default: 'draft', index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true }
  },
  { timestamps: true }
);

MailDraftSchema.index({ userEmail: 1, projectId: 1, createdAt: -1 });

export default mongoose.models.MailDraft || mongoose.model('MailDraft', MailDraftSchema);
