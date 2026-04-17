import mongoose from 'mongoose';

const EmailDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

EmailDraftSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.EmailDraft || mongoose.model('EmailDraft', EmailDraftSchema);
