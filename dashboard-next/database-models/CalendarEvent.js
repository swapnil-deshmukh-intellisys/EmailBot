import mongoose from 'mongoose';

const EVENT_TYPES = [
  'Campaign Launch',
  'Follow-up',
  'Meeting',
  'Reminder',
  'Task',
  'Client Call',
  'Team Activity',
  'Deadline',
  'Custom'
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const REMINDERS = ['None', '5 minutes before', '15 minutes before', '30 minutes before', '1 hour before', '1 day before'];
const REPEATS = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'];

const CalendarEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    type: { type: String, enum: EVENT_TYPES, default: 'Reminder' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    reminder: { type: String, enum: REMINDERS, default: 'None' },
    repeat: { type: String, enum: REPEATS, default: 'None' },
    notes: { type: String, default: '', trim: true },
    color: { type: String, default: '#2563eb' }
  },
  { timestamps: true }
);

CalendarEventSchema.index({ userEmail: 1, startDate: 1 });
CalendarEventSchema.index({ userId: 1, startDate: 1 });

export { EVENT_TYPES, PRIORITIES, REMINDERS, REPEATS };
export default mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', CalendarEventSchema);
