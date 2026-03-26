import mongoose from 'mongoose';

const EmailThreadSchema = new mongoose.Schema(
  {
    recipientEmail: { type: String, required: true, index: true },
    senderKey: { type: String, required: true, index: true },
    messageId: { type: String, default: '' },
    subject: { type: String, default: '' },
    to: { type: [String], default: [] },
    cc: { type: [String], default: [] },
    references: { type: [String], default: [] },
    provider: { type: String, default: '' },
    lastCampaignType: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

EmailThreadSchema.index({ recipientEmail: 1, senderKey: 1 }, { unique: true });

export default mongoose.models.EmailThread || mongoose.model('EmailThread', EmailThreadSchema);
