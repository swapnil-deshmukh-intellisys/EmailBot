import mongoose from 'mongoose';

const WarmupAutoReplySettingSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: false },
    replyTemplate: {
      type: String,
      default:
        "<div style=\"font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;\"><p style=\"margin:0 0 12px;\">Hi,</p><p style=\"margin:0 0 12px;\">Thank you for your email. This mailbox is active and warming up normally.</p><p style=\"margin:0;\">Best regards</p></div>"
    },
    keywords: {
      type: [String],
      default: ['warmup', 'warm up', 'warming', 'mailwarm', 'inbox warm', 'sender warm']
    },
    maxRepliesPerRun: { type: Number, default: 3 },
    lastCheckedAt: { type: Date, default: null },
    lastRepliedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

WarmupAutoReplySettingSchema.index({ userEmail: 1 }, { unique: true });

export default mongoose.models.WarmupAutoReplySetting || mongoose.model('WarmupAutoReplySetting', WarmupAutoReplySettingSchema);
