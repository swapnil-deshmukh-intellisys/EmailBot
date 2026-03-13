import mongoose from 'mongoose';

const SenderAccountSchema = new mongoose.Schema(
  {
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
    clientSecret: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.SenderAccount || mongoose.model('SenderAccount', SenderAccountSchema);