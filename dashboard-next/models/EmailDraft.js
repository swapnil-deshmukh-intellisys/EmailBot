import mongoose from 'mongoose';

const EmailDraftSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.models.EmailDraft || mongoose.model('EmailDraft', EmailDraftSchema);
