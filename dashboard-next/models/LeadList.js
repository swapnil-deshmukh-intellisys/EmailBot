import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    Name: String,
    Email: String,
    Company: String,
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending' },
    error: { type: String, default: '' },
    sentAt: { type: Date, default: null }
  },
  { _id: false }
);

const LeadListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sourceFile: { type: String, required: true },
    columns: { type: [String], default: [] },
    leads: { type: [LeadSchema], default: [] },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.LeadList || mongoose.model('LeadList', LeadListSchema);
