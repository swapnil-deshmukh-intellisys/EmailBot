import mongoose from 'mongoose';

const TIMELINE_PRIORITIES = ['High', 'Medium', 'Low'];
const TIMELINE_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const TIMELINE_CATEGORIES = ['Sales', 'Outreach', 'Follow-Up', 'Research', 'Management', 'Campaign', 'Custom'];

const TimelineTaskSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    projectName: { type: String, default: '' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priority: { type: String, enum: TIMELINE_PRIORITIES, default: 'Medium', index: true },
    status: { type: String, enum: TIMELINE_STATUSES, default: 'Pending', index: true },
    assignedByUserId: { type: String, default: '', index: true },
    assignedByEmail: { type: String, default: '', index: true },
    assignedByName: { type: String, default: '' },
    assignedToUserId: { type: String, default: '', index: true },
    assignedToEmail: { type: String, default: '', index: true },
    assignedToName: { type: String, default: '' },
    dueDate: { type: Date, required: true, index: true },
    dueTime: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    category: { type: String, enum: TIMELINE_CATEGORIES, default: 'Custom', index: true },
    notes: { type: String, default: '' },
    reminderAt: { type: Date, default: null, index: true },
    lastNotifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

TimelineTaskSchema.index({ userId: 1, dueDate: 1, status: 1 });
TimelineTaskSchema.index({ assignedToUserId: 1, dueDate: 1, status: 1 });
TimelineTaskSchema.index({ assignedToEmail: 1, dueDate: 1, status: 1 });
TimelineTaskSchema.index({ assignedByUserId: 1, createdAt: -1 });

export { TIMELINE_PRIORITIES, TIMELINE_STATUSES, TIMELINE_CATEGORIES };
export default mongoose.models.TimelineTask || mongoose.model('TimelineTask', TimelineTaskSchema);
