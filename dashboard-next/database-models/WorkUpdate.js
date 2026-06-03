import mongoose from 'mongoose';

const WORK_UPDATE_TYPES = [
  'Todo',
  'Follow-up',
  'Positive Reply',
  'Negative Reply',
  'Meeting',
  'Proposal Sent',
  'Call Done',
  'Email Sent',
  'Other'
];

const WORK_UPDATE_PRIORITIES = ['High', 'Medium', 'Low'];
const WORK_UPDATE_STATUSES = ['Pending', 'Completed', 'Carried Forward'];

const WorkUpdateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: '', index: true },
    workTitle: { type: String, required: true, trim: true },
    workType: { type: String, enum: WORK_UPDATE_TYPES, required: true, index: true },
    workDate: { type: Date, required: true, index: true },
    status: { type: String, enum: WORK_UPDATE_STATUSES, required: true, default: 'Pending', index: true },
    priority: { type: String, enum: WORK_UPDATE_PRIORITIES, default: 'Medium', index: true },
    relatedClientId: { type: String, default: '', index: true },
    relatedClientName: { type: String, default: '' },
    projectId: { type: String, default: '', index: true },
    projectName: { type: String, default: '' },
    campaignId: { type: String, default: '', index: true },
    campaignName: { type: String, default: '' },
    notes: { type: String, default: '' },
    completedAt: { type: Date, default: null },

    // Legacy fields are kept only so older saved records do not break reads.
    title: { type: String, default: '' },
    type: { type: String, default: '' },
    dueDate: { type: Date, default: null },
    dueTime: { type: String, default: '' }
  },
  { timestamps: true }
);

WorkUpdateSchema.index({ userId: 1, workDate: 1, status: 1 });
WorkUpdateSchema.index({ userId: 1, workTitle: 1, workType: 1, workDate: 1 });
WorkUpdateSchema.index({ userId: 1, updatedAt: -1 });

export { WORK_UPDATE_TYPES, WORK_UPDATE_PRIORITIES, WORK_UPDATE_STATUSES };
export default mongoose.models.WorkUpdate || mongoose.model('WorkUpdate', WorkUpdateSchema);
