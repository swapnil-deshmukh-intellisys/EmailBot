import mongoose from 'mongoose';

const PresetSenderSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    project: { type: String, enum: ['tec', 'tut'], required: true },
    createdAt: { type: Date, default: () => new Date() }
  },
  { timestamps: false }
);

PresetSenderSchema.index({ email: 1, project: 1 }, { unique: true });

export default mongoose.models.PresetSender || mongoose.model('PresetSender', PresetSenderSchema);
