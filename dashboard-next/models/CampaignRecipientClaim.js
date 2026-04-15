import mongoose from 'mongoose';

const CampaignRecipientClaimSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    recipientEmail: { type: String, required: true, index: true },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null },
    leadIndex: { type: Number, default: -1 },
    status: {
      type: String,
      enum: ['Sending', 'Sent', 'Failed', 'Bounced', 'Spam'],
      default: 'Sending'
    },
    claimedAt: { type: Date, default: Date.now },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    error: { type: String, default: '' }
  },
  { timestamps: true }
);

CampaignRecipientClaimSchema.index({ campaignId: 1, recipientEmail: 1 }, { unique: true });

export default mongoose.models.CampaignRecipientClaim || mongoose.model('CampaignRecipientClaim', CampaignRecipientClaimSchema);
