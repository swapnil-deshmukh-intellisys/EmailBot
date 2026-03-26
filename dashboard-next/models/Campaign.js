import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
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
    scheduledAt: { type: Date, default: null },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
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

export default mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
