import mongoose from 'mongoose';

const UserProfileSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    role: { type: String, default: 'user' },
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
    passwordHash: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
