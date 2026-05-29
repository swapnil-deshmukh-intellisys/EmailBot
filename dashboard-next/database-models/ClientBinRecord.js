import mongoose from 'mongoose';

const ClientBinRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    project: { type: String, default: '', index: true },
    sheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientSheet', default: null, index: true },
    sourceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientRecord', default: null, index: true },
    sourceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null, index: true },
    legacyLeadIndex: { type: Number, default: null },
    sheetName: { type: String, default: '' },
    deletedReason: { type: String, default: '' },
    restorePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: Date.now, index: true },
    restoredAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

ClientBinRecordSchema.index({ userId: 1, deletedAt: -1 });
ClientBinRecordSchema.index({ userEmail: 1, deletedAt: -1 });

export default mongoose.models.ClientBinRecord || mongoose.model('ClientBinRecord', ClientBinRecordSchema);
