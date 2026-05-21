import mongoose from 'mongoose';

const DRAFT_TYPES = [
  'initial_outreach',
  'cover_story',
  'followup',
  'reminder',
  'updated_cost',
  'final_cost',
  'open_followup',
  'final_followup',
  'custom'
];

const EmailDraftSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    draftType: { type: String, enum: DRAFT_TYPES, default: 'initial_outreach', index: true },
    project: { type: String, enum: ['', 'tec', 'tut'], default: '', index: true },
    senderAccountId: { type: String, default: '', index: true },
    senderFrom: { type: String, default: '', index: true },
    sector: { type: String, default: '', index: true },
    domain: { type: String, default: '', index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

EmailDraftSchema.index({ userId: 1, createdAt: -1 });
EmailDraftSchema.index({ userEmail: 1, createdAt: -1 });
EmailDraftSchema.index({ userId: 1, draftType: 1, updatedAt: -1 });
EmailDraftSchema.index({ userEmail: 1, draftType: 1, updatedAt: -1 });

export default mongoose.models.EmailDraft || mongoose.model('EmailDraft', EmailDraftSchema);
