import mongoose from 'mongoose';

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, required: true, unique: true, index: true },
    planName: { type: String, default: 'Basic' },
    monthlyLimit: { type: Number, default: 300 },
    dailyLimit: { type: Number, default: 500 },
    usedCredits: { type: Number, default: 0 },
    remainingCredits: { type: Number, default: 300 },
    usedToday: { type: Number, default: 0 },
    remainingToday: { type: Number, default: 500 },
    lastDailyResetAt: { type: Date, default: null },
    dailyUsedCredits: { type: Number, default: 0 },
    dailyRemainingCredits: { type: Number, default: 500 },
    lastDailyReset: { type: Date, default: null },
    renewalDate: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive', 'past_due', 'cancelled'], default: 'active' },
    upgradeRequestPending: { type: Boolean, default: false },
    requestedUpgradePlan: { type: String, default: null },
    requestedDailyLimit: { type: Number, default: null }
  },
  { timestamps: true }
);

UserSubscriptionSchema.index({ userEmail: 1, status: 1 });

export default mongoose.models.UserSubscription || mongoose.model('UserSubscription', UserSubscriptionSchema);
