import mongoose from 'mongoose';

const UploadPreviewRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, default: 0 },
    Name: { type: String, default: '' },
    Surname: { type: String, default: '' },
    Company: { type: String, default: '' },
    Designation: { type: String, default: '' },
    Email: { type: String, default: '' },
    Phone: { type: String, default: '' },
    Domain: { type: String, default: '' },
    Sector: { type: String, default: '' },
    Country: { type: String, default: '' },
    validationStatus: { type: String, enum: ['Valid', 'Duplicate', 'Invalid'], default: 'Valid' },
    reasons: { type: [String], default: [] }
  },
  { _id: false }
);

const UploadFileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    fileName: { type: String, required: true },
    uploadedDate: { type: Date, default: Date.now, index: true },
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    duplicateRecords: { type: Number, default: 0 },
    invalidRecords: { type: Number, default: 0 },
    uploadedBy: { type: String, default: '' },
    sourceListId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeadList', default: null },
    status: { type: String, enum: ['Valid', 'Duplicate', 'Invalid'], default: 'Valid', index: true },
    previewRows: { type: [UploadPreviewRowSchema], default: [] }
  },
  { timestamps: true }
);

UploadFileSchema.index({ userId: 1, uploadedDate: -1 });

export default mongoose.models.UploadFile || mongoose.model('UploadFile', UploadFileSchema);
