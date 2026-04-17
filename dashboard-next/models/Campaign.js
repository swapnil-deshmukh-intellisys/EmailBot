import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    name: { type: String, required: true },
    project: { type: String, default: '' },
    senderFrom: { type: String, default: '' },
    type: { type: String, default: '' },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate', required: false },
    draftType: { type: String, default: '' },
    inlineTemplate: {
      subject: { type: String, default: '' },
      body: { type: String, default: '' }
    },

    // Optional: reference an account from /api/accounts (db:<id> or env id)
    senderAccountId: { type: String, default: '' },

    // Snapshot for UI; campaigns can still run via senderAccountId resolution.
    senderAccount: {
      provider: { type: String, default: '' },
      label: { type: String, default: '' },
      from: { type: String, default: '' },
      host: { type: String, default: '' },
      port: { type: Number, default: null },
      secure: { type: Boolean, default: false },
      user: { type: String, default: '' },
      pass: { type: String, default: '' },
      tenantId: { type: String, default: '' },
      clientId: { type: String, default: '' },
      clientSecret: { type: String, default: '' }
    },
    status: {
      type: String,
      enum: ['Draft', 'Scheduled', 'Running', 'Paused', 'Completed', 'Failed'],
      default: 'Draft'
    },
    tracking: {
      enabled: { type: Boolean, default: false },
      opens: { type: Boolean, default: false },
      clicks: { type: Boolean, default: false },
      replies: { type: Boolean, default: false },
      updatedAt: { type: Date, default: null }
    },
    trackingStats: {
      openCount: { type: Number, default: 0 },
      clickCount: { type: Number, default: 0 },
      replyCount: { type: Number, default: 0 }
    },
    trackingEvents: [
      {
        type: { type: String, default: '' },
        email: { type: String, default: '' },
        target: { type: String, default: '' },
        at: { type: Date, default: Date.now },
        meta: {
          ip: { type: String, default: '' },
          userAgent: { type: String, default: '' }
        }
      }
    ],
    workflowStep: { type: Number, default: 1 },
    workflowStepLabel: { type: String, default: '' },
    scheduledAt: { type: Date, default: null },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      spam: { type: Number, default: 0 },
      pending: { type: Number, default: 0 }
    },
    options: {
      batchSize: { type: Number, default: 1 },
      delaySeconds: { type: Number, default: 60 },
      rowRange: { type: String, default: '' },
      replyMode: { type: Boolean, default: false }
    },
    logs: [{
      at: { type: Date, default: Date.now },
      level: { type: String, default: 'info' },
      message: String
    }],
    scheduledStart: {
      country: { type: String, default: '' },
      slot: { type: String, default: '' },
      timezone: { type: String, default: '' },
      label: { type: String, default: '' },
      at: { type: Date, default: null }
    },
    startedAt: Date,
    finishedAt: Date
  },
  { timestamps: true }
);

CampaignSchema.index({ userId: 1, createdAt: -1 });
CampaignSchema.index({ userEmail: 1, project: 1, senderFrom: 1, createdAt: -1 });
CampaignSchema.index({ userEmail: 1, status: 1, project: 1, senderFrom: 1 });

export default mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
