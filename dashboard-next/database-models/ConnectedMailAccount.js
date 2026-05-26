import mongoose from 'mongoose';

const ConnectedMailAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    provider: { type: String, enum: ['outlook'], default: 'outlook', index: true },
    email: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    tenantId: { type: String, default: 'organizations' },
    accessTokenEncrypted: { type: String, default: '' },
    refreshTokenEncrypted: { type: String, default: '' },
    expiresAt: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    status: { type: String, default: 'Connected', index: true },
    dailyLimit: { type: Number, default: 250 },
    warmupEnabled: { type: Boolean, default: false },
    lastSyncAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ConnectedMailAccountSchema.index({ userEmail: 1, email: 1, tenantId: 1 }, { unique: true });
ConnectedMailAccountSchema.index({ userId: 1, projectId: 1, status: 1 });

export default mongoose.models.ConnectedMailAccount || mongoose.model('ConnectedMailAccount', ConnectedMailAccountSchema);
