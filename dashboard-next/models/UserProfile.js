import mongoose from 'mongoose';

function normalizeOptionalIdentifier(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || undefined;
}

const UserProfileSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    intellisysUserId: {
      type: String,
      default: undefined,
      unique: true,
      sparse: true,
      index: true,
      set: normalizeOptionalIdentifier
    },
    name: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    username: { type: String, default: '', index: true },
    employeeId: { type: String, default: '', index: true },
    role: { type: String, default: 'user' },
    status: {
      type: String,
      enum: ['pending', 'active', 'blocked', 'rejected', 'inactive'],
      default: 'pending',
      index: true
    },
    displayName: { type: String, default: '' },
    avatarName: { type: String, default: '' },
    avatarDataUrl: { type: String, default: '' },
    planName: { type: String, default: 'Basic' },
    notificationPrefs: {
      campaignUpdates: { type: Boolean, default: true },
      replyAlerts: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: true }
    },
    totalCredits: { type: Number, default: 6000 },
    usedCredits: { type: Number, default: 0 },
    remainingCredits: { type: Number, default: 6000 },
    creditUsagePercent: { type: Number, default: 0 },
    targetApprovalStatus: { type: String, default: 'approved' },
    targetApprovalRequestedAt: { type: Date, default: null },
    targetApprovalReviewedAt: { type: Date, default: null },
    targetApprovalReviewer: { type: String, default: '' },
    targetApprovalRequestNote: { type: String, default: '' },
    timelineTasks: {
      type: Map,
      of: Boolean,
      default: {}
    },
    timelineCustomTasks: {
      type: [
        {
          id: { type: String, default: '' },
          date: { type: String, default: '' },
          time: { type: String, default: '' },
          title: { type: String, default: '' },
          text: { type: String, default: '' },
          type: { type: String, default: 'Reminder' },
          status: { type: String, default: 'pending' },
          done: { type: Boolean, default: false }
        }
      ],
      default: []
    },
    passwordHash: { type: String, default: '' },
    mustChangePassword: { type: Boolean, default: false },
    isFirstLogin: { type: Boolean, default: true },
    passwordChangedAt: { type: Date, default: null },
    resetPasswordTokenHash: { type: String, default: '' },
    resetPasswordTokenExpiresAt: { type: Date, default: null },
    createdByAdmin: { type: Boolean, default: false },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

UserProfileSchema.index({ role: 1, status: 1, updatedAt: -1 });
UserProfileSchema.index({ email: 1, username: 1, employeeId: 1 });
UserProfileSchema.index({ intellisysUserId: 1, status: 1 });

export default mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
