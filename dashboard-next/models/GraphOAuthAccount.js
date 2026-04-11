import mongoose from 'mongoose';

const GraphOAuthAccountSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    email: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    tenantId: { type: String, default: 'organizations' },
    scopes: { type: [String], default: [] },

    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    lastConnectedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'Connected' },
    lastSync: { type: Date, default: Date.now },
    dailyLimit: { type: Number, default: 250 },
    sentToday: { type: Number, default: 18 },
    errors: { type: Number, default: 0 },
    health: { type: String, default: 'Good' }
  },
  { timestamps: true }
);

GraphOAuthAccountSchema.index({ userEmail: 1, email: 1, tenantId: 1 }, { unique: true });

export default mongoose.models.GraphOAuthAccount || mongoose.model('GraphOAuthAccount', GraphOAuthAccountSchema);
