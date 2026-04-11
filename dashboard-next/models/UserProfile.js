import mongoose from 'mongoose';

const UserProfileSchema = new mongoose.Schema(
  {
    identifier: { type: String, required: true, unique: true, index: true },
    role: { type: String, default: 'user' },
    displayName: { type: String, default: '' },
    avatarName: { type: String, default: '' },
    avatarDataUrl: { type: String, default: '' },
    notificationPrefs: {
      campaignUpdates: { type: Boolean, default: true },
      replyAlerts: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: true }
    },
    passwordHash: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
