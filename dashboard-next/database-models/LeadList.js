import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    Name: String,
    Surname: { type: String, default: '' },
    Email: String,
    Company: String,
    Designation: { type: String, default: '' },
    Phone: { type: String, default: '' },
    Domain: { type: String, default: '' },
    Sector: { type: String, default: '' },
    Country: { type: String, default: '' },
    sourceFileId: { type: String, default: '' },
    sourceFileName: { type: String, default: '' },
    uploadDate: { type: Date, default: null },
    validationStatus: { type: String, enum: ['Valid', 'Duplicate', 'Invalid'], default: 'Valid' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['Pending', 'Sending', 'Sent', 'Failed', 'Bounced', 'Spam'], default: 'Pending' },
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
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    name: { type: String, required: true },
    sourceFile: { type: String, required: true },
    sourceFileId: { type: String, default: '' },
    sourceFileName: { type: String, default: '' },
    uploadDate: { type: Date, default: null },
    validationStatus: { type: String, enum: ['Valid', 'Duplicate', 'Invalid'], default: 'Valid' },
    kind: { type: String, default: 'uploaded', index: true },
    clonedFrom: { type: String, default: '' },
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

LeadListSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.LeadList || mongoose.model('LeadList', LeadListSchema);
