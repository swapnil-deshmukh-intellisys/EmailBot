import mongoose from 'mongoose';

const RecipientSendLockSchema = new mongoose.Schema(
  {
    recipientEmail: { type: String, required: true, unique: true, index: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null },
    leadIndex: { type: Number, default: -1 },
    status: {
      type: String,
      enum: ['Sending', 'Released'],
      default: 'Sending'
    },
    lockedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.models.RecipientSendLock || mongoose.model('RecipientSendLock', RecipientSendLockSchema);
