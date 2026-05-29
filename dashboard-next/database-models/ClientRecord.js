import mongoose from 'mongoose';

const ClientRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    project: { type: String, default: '', index: true },
    sheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientSheet', required: true, index: true },
    rowIndex: { type: Number, default: 0, index: true },
    name: { type: String, default: '' },
    surname: { type: String, default: '' },
    designation: { type: String, default: '' },
    companyName: { type: String, default: '' },
    sector: { type: String, default: '' },
    country: { type: String, default: '' },
    email: { type: String, default: '', index: true },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    source: { type: String, default: '' },
    leadType: { type: String, default: '' },
    sourcer: { type: String, default: '' },
    userIdText: { type: String, default: '' },
    projectApproach: { type: String, default: '' },
    senderId: { type: String, default: '' },
    listAddedDate: { type: Date, default: null },
    status: { type: String, default: 'Pending', index: true },
    isRepeated: { type: Boolean, default: false, index: true },
    duplicateReason: { type: String, default: '' },
    isInvalid: { type: Boolean, default: false, index: true },
    invalidReason: { type: String, default: '' },
    contactedCount: { type: Number, default: 0 },
    lastContactedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
    rawData: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

ClientRecordSchema.index({ sheetId: 1, rowIndex: 1 });
ClientRecordSchema.index({ userId: 1, email: 1 });
ClientRecordSchema.index({ userEmail: 1, email: 1 });
ClientRecordSchema.index({ userId: 1, project: 1, email: 1 });
ClientRecordSchema.index({ userEmail: 1, project: 1, email: 1 });

export default mongoose.models.ClientRecord || mongoose.model('ClientRecord', ClientRecordSchema);
