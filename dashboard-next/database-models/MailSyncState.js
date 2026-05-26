import mongoose from 'mongoose';

const MailSyncStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    accountId: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    provider: { type: String, default: 'outlook' },
    folderId: { type: String, default: 'inbox', index: true },
    deltaLink: { type: String, default: '' },
    lastSyncedAt: { type: Date, default: null },
    status: { type: String, default: 'idle' },
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

MailSyncStateSchema.index({ userEmail: 1, accountId: 1, folderId: 1 }, { unique: true });

export default mongoose.models.MailSyncState || mongoose.model('MailSyncState', MailSyncStateSchema);
