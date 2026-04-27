import mongoose from 'mongoose';

const CreditTransactionSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null, index: true },
    campaignName: { type: String, default: '' },
    recipientEmail: { type: String, default: '' },
    type: { type: String, enum: ['debit', 'credit', 'adjustment'], required: true },
    reason: { type: String, default: '' },
    credits: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

CreditTransactionSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.models.CreditTransaction || mongoose.model('CreditTransaction', CreditTransactionSchema);
