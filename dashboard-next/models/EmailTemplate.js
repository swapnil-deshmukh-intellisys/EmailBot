import mongoose from 'mongoose';

const EmailTemplateSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

EmailTemplateSchema.index({ userEmail: 1, createdAt: -1 });

export default mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema);
