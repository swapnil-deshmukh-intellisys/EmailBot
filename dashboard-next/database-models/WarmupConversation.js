import mongoose from 'mongoose';

const WarmupConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    warmupSheetId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarmupSheet', default: null, index: true },
    selectedSenderId: { type: String, default: '', index: true },
    receiverAccountId: { type: String, default: '', index: true },
    senderEmail: { type: String, default: '', index: true },
    receiverEmail: { type: String, default: '', index: true },
    threadId: { type: String, required: true, unique: true, index: true },
    totalMessages: { type: Number, default: 10 },
    currentMessageNumber: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'running', 'completed', 'paused', 'failed'], default: 'pending', index: true },
    nextMessageAt: { type: Date, default: null, index: true },
    lastMessageAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    mode: { type: String, enum: ['real', 'simulated', 'mixed'], default: 'simulated' },
    delayMinutes: { type: Number, default: 1 },
    lastError: { type: String, default: '' },
    failedReason: { type: String, default: '' }
  },
  { timestamps: true }
);

WarmupConversationSchema.index({ userId: 1, projectId: 1, status: 1, nextMessageAt: 1 });
WarmupConversationSchema.index({ userEmail: 1, projectId: 1, status: 1, nextMessageAt: 1 });
WarmupConversationSchema.index({ userEmail: 1, warmupSheetId: 1, senderEmail: 1, receiverEmail: 1 });

export default mongoose.models.WarmupConversation || mongoose.model('WarmupConversation', WarmupConversationSchema);
