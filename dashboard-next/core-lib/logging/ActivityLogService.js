import connectDB from '@/lib/mongodb';
import ActivityLog from '@/models/ActivityLogModel';

export async function createActivityLog({
  user = null,
  targetUser = null,
  action = '',
  entityType = '',
  entityId = '',
  meta = {}
} = {}) {
  if (!action) return null;

  await connectDB();

  const resolvedTarget = targetUser || user || {};
  const resolvedActor = user || {};

  return ActivityLog.create({
    userId: resolvedTarget?._id || null,
    userEmail: String(resolvedTarget?.email || resolvedTarget?.identifier || '').trim().toLowerCase(),
    actorId: resolvedActor?._id || null,
    actorEmail: String(resolvedActor?.email || resolvedActor?.identifier || '').trim().toLowerCase(),
    action,
    entityType,
    entityId: String(entityId || resolvedTarget?._id || ''),
    meta
  });
}
