import mongoose from 'mongoose';

const SenderAccountSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    provider: { type: String, enum: ['smtp', 'gmail', 'graph'], required: true },
    label: { type: String, default: '' },
    from: { type: String, required: true },

    host: { type: String, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    pass: { type: String, default: '' },

    tenantId: { type: String, default: '' },
    clientId: { type: String, default: '' },
    clientSecret: { type: String, default: '' },

    status: { type: String, default: 'Connected' },
    lastSync: { type: Date, default: Date.now },
    dailyLimit: { type: Number, default: 250 },
    sentToday: { type: Number, default: 18 },
    errors: { type: Number, default: 0 },
    health: { type: String, default: 'Good' }
  },
  { timestamps: true }
);

export default mongoose.models.SenderAccount || mongoose.model('SenderAccount', SenderAccountSchema);
