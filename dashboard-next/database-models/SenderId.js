import mongoose from 'mongoose';

const SenderIdSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // Encrypted app password
    provider: { type: String, required: true }, // Gmail / Outlook / SMTP
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    projectName: { type: String, required: true },
    status: { type: String, default: 'active' },
    healthStatus: { type: String, default: 'unchecked' }
  },
  { timestamps: true }
);

export default mongoose.models.SenderId || mongoose.model('SenderId', SenderIdSchema);
