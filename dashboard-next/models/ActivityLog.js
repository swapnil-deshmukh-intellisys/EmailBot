import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    action: { type: String, default: '' },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null },
    actorEmail: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

ActivityLogSchema.index({ userEmail: 1, createdAt: -1 });
ActivityLogSchema.index({ actorEmail: 1, createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
