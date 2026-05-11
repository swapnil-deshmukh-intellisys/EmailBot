import mongoose from 'mongoose';

const UpgradeRequestSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    currentPlan: { type: String, required: true },
    requestedPlan: { type: String, required: true },
    requestedDailyLimit: { type: Number, default: 500 },
    requestedMonthlyLimit: { type: Number, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    requestedAt: { type: Date, default: () => new Date() },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null }
  },
  { timestamps: true }
);

UpgradeRequestSchema.index({ userEmail: 1, status: 1 });
UpgradeRequestSchema.index({ status: 1, requestedAt: -1 });

export default mongoose.models.UpgradeRequest || mongoose.model('UpgradeRequest', UpgradeRequestSchema);
