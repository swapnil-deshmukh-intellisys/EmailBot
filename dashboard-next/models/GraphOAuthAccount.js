import mongoose from 'mongoose';

const GraphOAuthAccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    displayName: { type: String, default: '' },
    tenantId: { type: String, default: 'organizations' },
    scopes: { type: [String], default: [] },

    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    lastConnectedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

GraphOAuthAccountSchema.index({ email: 1, tenantId: 1 }, { unique: true });

export default mongoose.models.GraphOAuthAccount || mongoose.model('GraphOAuthAccount', GraphOAuthAccountSchema);