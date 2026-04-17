import mongoose from 'mongoose';

const SignupRequestSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    identifier: { type: String, default: '', index: true },
    requestedRole: { type: String, default: 'user' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'blocked'],
      default: 'pending',
      index: true
    },
    note: { type: String, default: '' },
    reviewedBy: { type: String, default: '' },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

SignupRequestSchema.index({ identifier: 1, status: 1, createdAt: -1 });

export default mongoose.models.SignupRequest || mongoose.model('SignupRequest', SignupRequestSchema);
