import mongoose from 'mongoose';

const MailMessageCacheSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    accountId: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    provider: { type: String, default: 'outlook' },
    graphMessageId: { type: String, required: true, index: true },
    folderId: { type: String, default: '', index: true },
    folder: { type: String, default: '' },
    subject: { type: String, default: '' },
    fromEmail: { type: String, default: '', index: true },
    toEmails: { type: [String], default: [] },
    snippet: { type: String, default: '' },
    receivedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    isRead: { type: Boolean, default: false, index: true },
    hasAttachments: { type: Boolean, default: false },
    conversationId: { type: String, default: '', index: true },
    internetMessageId: { type: String, default: '' },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

MailMessageCacheSchema.index({ userEmail: 1, accountId: 1, graphMessageId: 1 }, { unique: true });
MailMessageCacheSchema.index({ userEmail: 1, fromEmail: 1, receivedAt: -1 });

export default mongoose.models.MailMessageCache || mongoose.model('MailMessageCache', MailMessageCacheSchema);
