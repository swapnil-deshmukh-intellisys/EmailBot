import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    Name: String,
    Email: String,
    Company: String,
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['Pending', 'Sending', 'Sent', 'Failed'], default: 'Pending' },
    error: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    sendingStartedAt: { type: Date, default: null },
    thread: {
      messageId: { type: String, default: '' },
      subject: { type: String, default: '' },
      recipientEmail: { type: String, default: '' },
      to: { type: [String], default: [] },
      cc: { type: [String], default: [] },
      references: { type: [String], default: [] },
      lastCampaignType: { type: String, default: '' },
      updatedAt: { type: Date, default: null }
    }
  },
  { _id: false }
);

const LeadListSchema = new mongoose.Schema(
  {
    userEmail: { type: String, default: '', index: true },
    name: { type: String, required: true },
    sourceFile: { type: String, required: true },
    columns: { type: [String], default: [] },
    sheetStyle: {
      fontFamily: { type: String, default: 'Segoe UI' },
      fontSize: { type: Number, default: 14 },
      headerBg: { type: String, default: '#edf2f7' },
      headerColor: { type: String, default: '#1e293b' },
      cellBg: { type: String, default: '#ffffff' },
      cellColor: { type: String, default: '#0f172a' },
      columnWidths: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    leads: { type: [LeadSchema], default: [] },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.LeadList || mongoose.model('LeadList', LeadListSchema);
