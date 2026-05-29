import mongoose from 'mongoose';

const ClientSheetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    project: { type: String, default: '', index: true },
    sheetName: { type: String, required: true },
    originalFileName: { type: String, default: '' },
    sourceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null, index: true },
    kind: { type: String, default: 'uploaded', index: true },
    totalRows: { type: Number, default: 0 },
    freshCount: { type: Number, default: 0 },
    repeatedCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    contactedCount: { type: Number, default: 0 },
    columns: { type: [String], default: [] },
    columnWidths: { type: mongoose.Schema.Types.Mixed, default: {} },
    filterViews: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdBy: { type: String, default: '' },
    deletedAt: { type: Date, default: null, index: true },
    deleteReason: { type: String, default: '' }
  },
  { timestamps: true }
);

ClientSheetSchema.index({ userId: 1, updatedAt: -1 });
ClientSheetSchema.index({ userEmail: 1, updatedAt: -1 });
ClientSheetSchema.index({ userId: 1, project: 1, updatedAt: -1 });
ClientSheetSchema.index({ userEmail: 1, project: 1, updatedAt: -1 });
ClientSheetSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });
ClientSheetSchema.index({ userEmail: 1, deletedAt: 1, updatedAt: -1 });

export default mongoose.models.ClientSheet || mongoose.model('ClientSheet', ClientSheetSchema);
