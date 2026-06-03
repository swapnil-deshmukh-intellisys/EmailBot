import mongoose from 'mongoose';

const CampaignWorkerHeartbeatSchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, unique: true, index: true },
    host: { type: String, default: '' },
    pid: { type: Number, default: null },
    status: { type: String, default: 'running', index: true },
    startedAt: { type: Date, default: Date.now },
    lastHeartbeatAt: { type: Date, default: Date.now, index: true },
    intervalMs: { type: Number, default: 10000 },
    version: { type: String, default: '' },
    lastError: { type: String, default: '' },
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

CampaignWorkerHeartbeatSchema.index({ status: 1, lastHeartbeatAt: -1 });

export default mongoose.models.CampaignWorkerHeartbeat ||
  mongoose.model('CampaignWorkerHeartbeat', CampaignWorkerHeartbeatSchema);
