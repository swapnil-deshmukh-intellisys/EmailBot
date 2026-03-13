import mongoose from 'mongoose';

const EmailDraftSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.models.EmailDraft || mongoose.model('EmailDraft', EmailDraftSchema);
