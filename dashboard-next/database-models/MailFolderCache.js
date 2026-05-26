import mongoose from 'mongoose';

const MailFolderCacheSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    accountId: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    provider: { type: String, default: 'outlook' },
    graphFolderId: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    parentFolderId: { type: String, default: '' },
    unreadCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

MailFolderCacheSchema.index({ userEmail: 1, accountId: 1, graphFolderId: 1 }, { unique: true });

export default mongoose.models.MailFolderCache || mongoose.model('MailFolderCache', MailFolderCacheSchema);
