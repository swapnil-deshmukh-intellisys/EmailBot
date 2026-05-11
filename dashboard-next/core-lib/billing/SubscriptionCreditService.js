import Campaign from '../../database-models/Campaign.js';
import UserProfile from '../../database-models/UserProfile.js';
import UserSubscription from '../../database-models/UserSubscription.js';
import CreditTransaction from '../../database-models/CreditTransaction.js';
import UpgradeRequest from '../../database-models/UpgradeRequest.js';
import { USER_ACCOUNT_STATUSES } from '../auth-config/AuthSessionService.js';

export const PLAN_LIMITS = {
  Basic: 300,
  Starter: 2000,
  Professional: 10000,
  Enterprise: 0
};

export const PLAN_ORDER = ['Basic', 'Starter', 'Professional', 'Enterprise'];
export const DEFAULT_DAILY_MAIL_LIMIT = 500;
export const PLAN_DAILY_LIMITS = {
  Basic: DEFAULT_DAILY_MAIL_LIMIT,
  Starter: 1000,
  Professional: 2000,
  Enterprise: 5000
};

export function normalizePlanName(value = 'Basic') {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (normalizedValue === 'pro') return 'Professional';
  const match = PLAN_ORDER.find((plan) => plan.toLowerCase() === normalizedValue);
  return match || 'Basic';
}

export function getPlanLimit(planName = 'Basic', fallback = 300) {
  const normalized = normalizePlanName(planName);
  const limit = Number(PLAN_LIMITS[normalized] ?? fallback);
  return normalized === 'Enterprise' ? Number(fallback || 0) : Math.max(0, limit);
}

export function getPlanDailyLimit(planName = 'Basic', fallback = DEFAULT_DAILY_MAIL_LIMIT) {
  const normalized = normalizePlanName(planName);
  return Math.max(DEFAULT_DAILY_MAIL_LIMIT, Number(PLAN_DAILY_LIMITS[normalized] || fallback || DEFAULT_DAILY_MAIL_LIMIT));
}

export function getNextPlan(planName = 'Basic') {
  const normalized = normalizePlanName(planName);
  const index = PLAN_ORDER.indexOf(normalized);
  return PLAN_ORDER[Math.min(PLAN_ORDER.length - 1, Math.max(0, index + 1))] || 'Starter';
}

export function getCurrentBillingWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const renewalDate = end;
  return { start, end, renewalDate };
}

export function getCurrentDailyWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

export function getUsageTone(percent = 0) {
  const value = Number(percent || 0);
  if (value >= 100) return 'blocked';
  if (value >= 95) return 'danger';
  if (value >= 80) return 'warning';
  return 'healthy';
}

async function countSentEmailsThisMonth(userEmail = '', window = getCurrentBillingWindow()) {
  const [result] = await Campaign.aggregate([
    { $match: { userEmail } },
    { $unwind: '$logs' },
    {
      $match: {
        'logs.at': { $gte: window.start, $lt: window.end },
        'logs.message': /^Sent:/i
      }
    },
    { $count: 'count' }
  ]);
  return Number(result?.count || 0);
}

async function countSentEmailsToday(userEmail = '', window = getCurrentDailyWindow()) {
  const [result] = await Campaign.aggregate([
    { $match: { userEmail } },
    { $unwind: '$logs' },
    {
      $match: {
        'logs.at': { $gte: window.start, $lt: window.end },
        'logs.message': /^Sent:/i
      }
    },
    { $count: 'count' }
  ]);
  return Number(result?.count || 0);
}

async function countReservedEmailsThisMonth(userEmail = '', window = getCurrentBillingWindow()) {
  const [result] = await CreditTransaction.aggregate([
    {
      $match: {
        userEmail,
        type: 'debit',
        reason: 'credit_reserved_for_send',
        createdAt: { $gte: window.start, $lt: window.end }
      }
    },
    { $group: { _id: null, total: { $sum: '$credits' } } }
  ]);
  return Number(result?.total || 0);
}

async function countReservedEmailsToday(userEmail = '', window = getCurrentDailyWindow()) {
  const [result] = await CreditTransaction.aggregate([
    {
      $match: {
        userEmail,
        type: 'debit',
        reason: 'credit_reserved_for_send',
        createdAt: { $gte: window.start, $lt: window.end }
      }
    },
    { $group: { _id: null, total: { $sum: '$credits' } } }
  ]);
  return Number(result?.total || 0);
}

async function getPendingUpgradeRequest(userEmail = '') {
  return UpgradeRequest.findOne({
    userEmail,
    status: 'pending'
  }).sort({ requestedAt: -1 }).lean();
}

export async function getOrCreateSubscriptionSummary(userEmail = '', user = null) {
  const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();
  if (!normalizedUserEmail) {
    throw new Error('User email is required');
  }

  const window = getCurrentBillingWindow();
  const dailyWindow = getCurrentDailyWindow();
  const profile = await UserProfile.findOneAndUpdate(
    {
      $or: [
        { identifier: normalizedUserEmail },
        { email: normalizedUserEmail },
        { username: normalizedUserEmail },
        { employeeId: normalizedUserEmail },
        { intellisysUserId: normalizedUserEmail }
      ]
    },
    {
      $setOnInsert: {
        identifier: normalizedUserEmail,
        intellisysUserId: normalizedUserEmail,
        email: normalizedUserEmail,
        username: normalizedUserEmail,
        status: USER_ACCOUNT_STATUSES.ACTIVE,
        role: user?.role || 'user',
        planName: 'Basic',
        totalCredits: PLAN_LIMITS.Basic,
        usedCredits: 0,
        remainingCredits: PLAN_LIMITS.Basic,
        creditUsagePercent: 0
      }
    },
    { upsert: true, new: true }
  );

  const subscription = await UserSubscription.findOne({ userEmail: normalizedUserEmail });
  const planName = normalizePlanName(subscription?.planName || profile?.planName || 'Basic');
  const monthlyLimit = Math.max(0, Number(subscription?.monthlyLimit || getPlanLimit(planName, profile?.totalCredits || PLAN_LIMITS.Basic)));
  const monthlySentCount = await countSentEmailsThisMonth(normalizedUserEmail, window);
  const monthlyReservedCount = await countReservedEmailsThisMonth(normalizedUserEmail, window);
  const usedCredits = Math.min(monthlyLimit, Math.max(monthlySentCount, monthlyReservedCount));
  const remainingCredits = Math.max(0, monthlyLimit - usedCredits);
  const usagePercentage = monthlyLimit ? Math.min(100, Math.round((usedCredits / monthlyLimit) * 100)) : 0;
  const dailyLimit = Math.max(1, Number(subscription?.dailyLimit || DEFAULT_DAILY_MAIL_LIMIT));
  const dailySentCount = await countSentEmailsToday(normalizedUserEmail, dailyWindow);
  const dailyReservedCount = await countReservedEmailsToday(normalizedUserEmail, dailyWindow);
  const dailyUsedCredits = Math.min(dailyLimit, Math.max(dailySentCount, dailyReservedCount));
  const dailyRemainingCredits = Math.max(0, dailyLimit - dailyUsedCredits);
  const dailyUsagePercentage = dailyLimit ? Math.min(100, Math.round((dailyUsedCredits / dailyLimit) * 100)) : 0;
  const nextPlan = getNextPlan(planName);
  const status = subscription?.status || 'active';
  const pendingUpgradeRequest = await getPendingUpgradeRequest(normalizedUserEmail);

  const savedSubscription = await UserSubscription.findOneAndUpdate(
    { userEmail: normalizedUserEmail },
    {
      $set: {
        userId: user?._id || profile?._id || null,
        planName,
        monthlyLimit,
        dailyLimit,
        usedCredits,
        remainingCredits,
        usedToday: dailyUsedCredits,
        remainingToday: dailyRemainingCredits,
        lastDailyResetAt: dailyWindow.start,
        dailyUsedCredits,
        dailyRemainingCredits,
        lastDailyReset: dailyWindow.start,
        renewalDate: window.renewalDate,
        status,
        upgradeRequestPending: Boolean(pendingUpgradeRequest),
        requestedUpgradePlan: pendingUpgradeRequest?.requestedPlan || null
      }
    },
    { upsert: true, new: true }
  ).lean();

  await UserProfile.updateOne(
    { _id: profile._id },
    {
      $set: {
        planName,
        totalCredits: monthlyLimit,
        usedCredits,
        remainingCredits,
        creditUsagePercent: usagePercentage
      }
    }
  );

  return {
    subscription: savedSubscription,
    summary: {
      planName,
      currentPlan: planName,
      monthlyLimit,
      totalCredits: monthlyLimit,
      usedCredits,
      remainingCredits,
      usagePercentage,
      creditUsagePercent: usagePercentage,
      dailyLimit,
      usedToday: dailyUsedCredits,
      remainingToday: dailyRemainingCredits,
      lastDailyResetAt: dailyWindow.start,
      dailyUsedCredits,
      dailyRemainingCredits,
      dailyUsagePercentage,
      nextPlan,
      upgradeTargetPlan: nextPlan,
      upgradeTargetCredits: getPlanLimit(nextPlan, monthlyLimit),
      upgradeTargetDailyLimit: getPlanDailyLimit(nextPlan, dailyLimit),
      upgradeRequestPending: Boolean(pendingUpgradeRequest),
      requestedUpgradePlan: pendingUpgradeRequest?.requestedPlan || null,
      pendingUpgradeRequestId: pendingUpgradeRequest?._id ? String(pendingUpgradeRequest._id) : null,
      renewalDate: window.renewalDate,
      status,
      warningLevel: getUsageTone(usagePercentage),
      dailyWarningLevel: getUsageTone(dailyUsagePercentage),
      sendingDisabled: status !== 'active' || remainingCredits <= 0 || dailyRemainingCredits <= 0
    }
  };
}

export async function requestSubscriptionUpgrade(userEmail = '', user = null, requestedPlan = '') {
  const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();
  if (!normalizedUserEmail) {
    throw new Error('User email is required');
  }

  const current = await getOrCreateSubscriptionSummary(normalizedUserEmail, user);
  const nextPlan = normalizePlanName(requestedPlan || current.summary.nextPlan || 'Starter');
  const requestedDailyLimit = getPlanDailyLimit(nextPlan, current.summary.dailyLimit);
  if (nextPlan === current.summary.planName) {
    throw new Error('You are already on this plan');
  }

  const request = await UpgradeRequest.findOneAndUpdate(
    { userEmail: normalizedUserEmail, status: 'pending' },
    {
      $set: {
        userEmail: normalizedUserEmail,
        userId: user?._id || current.subscription?.userId || null,
        currentPlan: current.summary.planName,
        requestedPlan: nextPlan,
        requestedDailyLimit,
        requestedMonthlyLimit: getPlanLimit(nextPlan, current.summary.monthlyLimit),
        requestedAt: new Date(),
        notes: `Requested daily mail limit: ${requestedDailyLimit}`
      }
    },
    { upsert: true, new: true }
  ).lean();

  await UserSubscription.updateOne(
    { userEmail: normalizedUserEmail },
    {
      $set: {
        upgradeRequestPending: true,
        requestedUpgradePlan: nextPlan,
        requestedDailyLimit
      }
    }
  );

  return {
    request,
    subscription: current.subscription,
    summary: {
      ...current.summary,
      upgradeRequestPending: true,
      requestedUpgradePlan: nextPlan,
      requestedDailyLimit,
      upgradeTargetDailyLimit: requestedDailyLimit,
      pendingUpgradeRequestId: String(request._id)
    }
  };
}

export async function upgradeSubscriptionPlan(userEmail = '', user = null, requestedPlan = '') {
  const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();
  const current = await getOrCreateSubscriptionSummary(normalizedUserEmail, user);
  const nextPlan = normalizePlanName(requestedPlan || current.summary.nextPlan || 'Starter');
  const monthlyLimit = getPlanLimit(nextPlan, current.summary.monthlyLimit);
  const dailyLimit = getPlanDailyLimit(nextPlan, current.summary.dailyLimit || DEFAULT_DAILY_MAIL_LIMIT);
  const window = getCurrentBillingWindow();
  const dailyWindow = getCurrentDailyWindow();
  const usedCredits = Math.min(monthlyLimit, Number(current.summary.usedCredits || 0));
  const remainingCredits = Math.max(0, monthlyLimit - usedCredits);
  const usagePercentage = monthlyLimit ? Math.min(100, Math.round((usedCredits / monthlyLimit) * 100)) : 0;
  const dailyUsedCredits = Math.min(dailyLimit, Number(current.summary.dailyUsedCredits || 0));
  const dailyRemainingCredits = Math.max(0, dailyLimit - dailyUsedCredits);
  const dailyUsagePercentage = dailyLimit ? Math.min(100, Math.round((dailyUsedCredits / dailyLimit) * 100)) : 0;

  const subscription = await UserSubscription.findOneAndUpdate(
    { userEmail: normalizedUserEmail },
    {
      $set: {
        userId: user?._id || current.subscription?.userId || null,
        planName: nextPlan,
        monthlyLimit,
        dailyLimit,
        usedCredits,
        remainingCredits,
        usedToday: dailyUsedCredits,
        remainingToday: dailyRemainingCredits,
        lastDailyResetAt: dailyWindow.start,
        dailyUsedCredits,
        dailyRemainingCredits,
        lastDailyReset: dailyWindow.start,
        renewalDate: window.renewalDate,
        status: 'active',
        upgradeRequestPending: false,
        requestedUpgradePlan: null
      }
    },
    { upsert: true, new: true }
  ).lean();

  await UserProfile.updateOne(
    {
      $or: [
        { identifier: normalizedUserEmail },
        { email: normalizedUserEmail },
        { username: normalizedUserEmail },
        { employeeId: normalizedUserEmail },
        { intellisysUserId: normalizedUserEmail }
      ]
    },
    {
      $set: {
        planName: nextPlan,
        totalCredits: monthlyLimit,
        usedCredits,
        remainingCredits,
        creditUsagePercent: usagePercentage
      }
    }
  );

  await CreditTransaction.create({
    userEmail: normalizedUserEmail,
    campaignId: null,
    type: 'credit',
    credits: Math.max(0, monthlyLimit - Number(current.summary.monthlyLimit || 0)),
    reason: 'plan_upgrade',
    campaignName: nextPlan,
    recipientEmail: '',
    balanceAfter: remainingCredits,
    meta: {
      previousPlan: current.summary.planName,
      upgradedTo: nextPlan,
      monthlyLimit
    }
  });

  return {
    subscription,
    summary: {
      ...current.summary,
      planName: nextPlan,
      currentPlan: nextPlan,
      monthlyLimit,
      totalCredits: monthlyLimit,
      usedCredits,
      remainingCredits,
      usagePercentage,
      creditUsagePercent: usagePercentage,
      dailyLimit,
      usedToday: dailyUsedCredits,
      remainingToday: dailyRemainingCredits,
      lastDailyResetAt: dailyWindow.start,
      dailyUsedCredits,
      dailyRemainingCredits,
      dailyUsagePercentage,
      nextPlan: getNextPlan(nextPlan),
      upgradeTargetPlan: getNextPlan(nextPlan),
      upgradeTargetCredits: getPlanLimit(getNextPlan(nextPlan), monthlyLimit),
      upgradeTargetDailyLimit: getPlanDailyLimit(getNextPlan(nextPlan), dailyLimit),
      upgradeRequestPending: false,
      requestedUpgradePlan: null,
      pendingUpgradeRequestId: null,
      renewalDate: window.renewalDate,
      status: 'active',
      warningLevel: getUsageTone(usagePercentage),
      dailyWarningLevel: getUsageTone(dailyUsagePercentage),
      sendingDisabled: remainingCredits <= 0 || dailyRemainingCredits <= 0
    }
  };
}

export async function reviewSubscriptionUpgradeRequest(requestId = '', adminUser = null, decision = 'approved', overrides = {}) {
  const request = await UpgradeRequest.findById(requestId);
  if (!request) {
    throw new Error('Upgrade request not found');
  }
  if (request.status !== 'pending') {
    throw new Error('Upgrade request was already reviewed');
  }

  const normalizedDecision = String(decision || '').trim().toLowerCase();
  if (normalizedDecision === 'approved') {
    const result = await updateSubscriptionLimitsForAdmin(request.userEmail, adminUser, {
      planName: overrides.planName || request.requestedPlan,
      monthlyLimit: Number.isFinite(Number(overrides.monthlyLimit)) ? Number(overrides.monthlyLimit) : request.requestedMonthlyLimit,
      dailyLimit: Number.isFinite(Number(overrides.dailyLimit)) ? Number(overrides.dailyLimit) : request.requestedDailyLimit
    });
    request.status = 'approved';
    request.approvedAt = new Date();
    request.approvedBy = adminUser?.email || adminUser?.identifier || 'admin';
    await request.save();
    return { request: request.toObject(), ...result };
  }

  if (normalizedDecision !== 'rejected') {
    throw new Error('Invalid upgrade decision');
  }

  request.status = 'rejected';
  request.rejectedAt = new Date();
  request.approvedBy = adminUser?.email || adminUser?.identifier || 'admin';
  await request.save();

  await UserSubscription.updateOne(
    { userEmail: request.userEmail },
    {
      $set: {
        upgradeRequestPending: false,
        requestedUpgradePlan: null,
        requestedDailyLimit: null
      }
    }
  );

  const current = await getOrCreateSubscriptionSummary(request.userEmail, adminUser);
  return { request: request.toObject(), ...current };
}

export async function updateSubscriptionLimitsForAdmin(userEmail = '', adminUser = null, updates = {}) {
  const normalizedUserEmail = String(userEmail || '').trim().toLowerCase();
  if (!normalizedUserEmail) {
    throw new Error('User email is required');
  }

  const current = await getOrCreateSubscriptionSummary(normalizedUserEmail);
  const planName = updates.planName ? normalizePlanName(updates.planName) : current.summary.planName;
  const requestedMonthlyLimit = Number(updates.monthlyLimit);
  const requestedDailyLimit = Number(updates.dailyLimit);
  const extraCredits = Math.max(0, Number(updates.extraCredits || 0));
  const monthlyLimit = Number.isFinite(requestedMonthlyLimit)
    ? Math.max(0, requestedMonthlyLimit)
    : Math.max(0, Number(current.summary.monthlyLimit || getPlanLimit(planName, PLAN_LIMITS.Basic)));
  const dailyLimit = Number.isFinite(requestedDailyLimit)
    ? Math.max(DEFAULT_DAILY_MAIL_LIMIT, requestedDailyLimit)
    : Math.max(DEFAULT_DAILY_MAIL_LIMIT, Number(current.summary.dailyLimit || DEFAULT_DAILY_MAIL_LIMIT));
  const finalMonthlyLimit = monthlyLimit + extraCredits;
  const usedCredits = Math.min(finalMonthlyLimit, Number(current.summary.usedCredits || 0));
  const remainingCredits = Math.max(0, finalMonthlyLimit - usedCredits);
  const usedToday = Math.min(dailyLimit, Number(current.summary.usedToday ?? current.summary.dailyUsedCredits ?? 0));
  const remainingToday = Math.max(0, dailyLimit - usedToday);
  const usagePercentage = finalMonthlyLimit ? Math.min(100, Math.round((usedCredits / finalMonthlyLimit) * 100)) : 0;
  const dailyUsagePercentage = dailyLimit ? Math.min(100, Math.round((usedToday / dailyLimit) * 100)) : 0;
  const dailyWindow = getCurrentDailyWindow();

  const subscription = await UserSubscription.findOneAndUpdate(
    { userEmail: normalizedUserEmail },
    {
      $set: {
        planName,
        monthlyLimit: finalMonthlyLimit,
        dailyLimit,
        usedCredits,
        remainingCredits,
        usedToday,
        remainingToday,
        lastDailyResetAt: dailyWindow.start,
        dailyUsedCredits: usedToday,
        dailyRemainingCredits: remainingToday,
        lastDailyReset: dailyWindow.start,
        status: String(updates.status || current.summary.status || 'active').trim().toLowerCase() || 'active',
        upgradeRequestPending: false,
        requestedUpgradePlan: null,
        requestedDailyLimit: null
      }
    },
    { upsert: true, new: true }
  ).lean();

  await UserProfile.updateOne(
    {
      $or: [
        { identifier: normalizedUserEmail },
        { email: normalizedUserEmail },
        { username: normalizedUserEmail },
        { employeeId: normalizedUserEmail },
        { intellisysUserId: normalizedUserEmail }
      ]
    },
    {
      $set: {
        planName,
        totalCredits: finalMonthlyLimit,
        usedCredits,
        remainingCredits,
        creditUsagePercent: usagePercentage
      }
    }
  );

  if (extraCredits > 0) {
    await CreditTransaction.create({
      userEmail: normalizedUserEmail,
      campaignId: null,
      type: 'credit',
      credits: extraCredits,
      reason: 'admin_extra_credits',
      campaignName: planName,
      recipientEmail: '',
      balanceAfter: remainingCredits,
      meta: {
        admin: adminUser?.email || adminUser?.identifier || 'admin',
        monthlyLimit: finalMonthlyLimit,
        dailyLimit
      }
    });
  }

  return {
    subscription,
    summary: {
      ...current.summary,
      planName,
      currentPlan: planName,
      monthlyLimit: finalMonthlyLimit,
      totalCredits: finalMonthlyLimit,
      usedCredits,
      remainingCredits,
      usagePercentage,
      creditUsagePercent: usagePercentage,
      dailyLimit,
      usedToday,
      remainingToday,
      lastDailyResetAt: dailyWindow.start,
      dailyUsedCredits: usedToday,
      dailyRemainingCredits: remainingToday,
      dailyUsagePercentage,
      upgradeRequestPending: false,
      requestedUpgradePlan: null,
      pendingUpgradeRequestId: null,
      warningLevel: getUsageTone(usagePercentage),
      dailyWarningLevel: getUsageTone(dailyUsagePercentage),
      sendingDisabled: remainingCredits <= 0 || remainingToday <= 0
    }
  };
}
