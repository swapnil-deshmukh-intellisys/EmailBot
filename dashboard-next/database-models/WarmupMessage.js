import mongoose from 'mongoose';

const WarmupMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null, index: true },
    userEmail: { type: String, default: '', index: true },
    projectId: { type: String, default: '', index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WarmupConversation', required: true, index: true },
    threadId: { type: String, required: true, index: true },
    messageNumber: { type: Number, required: true, index: true },
    fromAccountId: { type: String, default: '', index: true },
    toAccountId: { type: String, default: '', index: true },
    fromEmail: { type: String, default: '', index: true },
    toEmail: { type: String, default: '', index: true },
    fromType: { type: String, enum: ['connected_sender', 'internal_bot', 'simulated'], default: 'simulated', index: true },
    toType: { type: String, enum: ['connected_sender', 'internal_bot', 'simulated'], default: 'simulated', index: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'sent', 'simulated', 'failed'], default: 'pending', index: true },
    provider: { type: String, enum: ['outlook', 'gmail', 'smtp', 'internal'], default: 'internal' },
    providerMessageId: { type: String, default: '' },
    sentAt: { type: Date, default: null },
    failedReason: { type: String, default: '' },
    simulatedReply: { type: Boolean, default: false }
  },
  { timestamps: true }
);

WarmupMessageSchema.index({ userEmail: 1, projectId: 1, createdAt: -1 });
WarmupMessageSchema.index({ conversationId: 1, messageNumber: 1 }, { unique: true });

export default mongoose.models.WarmupMessage || mongoose.model('WarmupMessage', WarmupMessageSchema);
