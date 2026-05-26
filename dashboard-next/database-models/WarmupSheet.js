import mongoose from 'mongoose';

const WarmupSheetRowSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    warmupApproved: { type: Boolean, default: false, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const WarmupSheetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    sheetName: { type: String, required: true },
    rows: { type: [WarmupSheetRowSchema], default: [] },
    parseStats: {
      totalRows: { type: Number, default: 0 },
      approvedRows: { type: Number, default: 0 },
      invalidRows: { type: Number, default: 0 },
      duplicateRows: { type: Number, default: 0 },
      approvalColumnMissing: { type: Boolean, default: false },
      skippedReasons: { type: [mongoose.Schema.Types.Mixed], default: [] }
    },
    uploadedAt: { type: Date, default: Date.now },
    isDefault: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

WarmupSheetSchema.index({ userId: 1, projectId: 1, uploadedAt: -1 });
WarmupSheetSchema.index({ userEmail: 1, projectId: 1, uploadedAt: -1 });
WarmupSheetSchema.index({ userEmail: 1, projectId: 1, isDefault: 1 });

export default mongoose.models.WarmupSheet || mongoose.model('WarmupSheet', WarmupSheetSchema);
