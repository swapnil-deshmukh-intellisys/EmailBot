import mongoose from 'mongoose';

const WarmupAutoReplyLogSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    mailboxEmail: { type: String, required: true, index: true },
    graphMessageId: { type: String, required: true },
    internetMessageId: { type: String, default: '' },
    conversationId: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    subject: { type: String, default: '' },
    status: { type: String, enum: ['replied', 'skipped', 'failed'], default: 'replied' },
    note: { type: String, default: '' },
    replyBody: { type: String, default: '' },
    repliedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

WarmupAutoReplyLogSchema.index({ userEmail: 1, mailboxEmail: 1, graphMessageId: 1 }, { unique: true });

export default mongoose.models.WarmupAutoReplyLog || mongoose.model('WarmupAutoReplyLog', WarmupAutoReplyLogSchema);
