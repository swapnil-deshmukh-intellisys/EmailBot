import mongoose from 'mongoose';

const TargetApprovalSchema = new mongoose.Schema(
  {
    requesterEmail: { type: String, required: true, index: true },
    requesterRole: { type: String, default: 'user' },
    targetPeriod: { type: String, default: 'daily' },
    targetDailyCount: { type: Number, default: 300 },
    status: { type: String, default: 'pending', index: true },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewerEmail: { type: String, default: '' },
    reviewerRole: { type: String, default: '' },
    requestNote: { type: String, default: '' },
    reviewNote: { type: String, default: '' }
  },
  { timestamps: true }
);

TargetApprovalSchema.index({ requesterEmail: 1, status: 1, createdAt: -1 });

export default mongoose.models.TargetApproval || mongoose.model('TargetApproval', TargetApprovalSchema);
