import { useMemo } from 'react';

function calculateRate(value, total) {
  if (!total) return 0;
  return (Number(value || 0) / Number(total || 0)) * 100;
}

export default function useStats(stats = {}) {
  return useMemo(() => {
    const totalValue = Number(stats.totalUploaded || 0);
    const safeTotal = Math.max(totalValue, 1);
    const sentRate = calculateRate(stats.sent, totalValue);
    const pendingRate = calculateRate(stats.pending, totalValue);
    const failedRate = calculateRate(stats.failed, totalValue);
    const recentActivityRate = calculateRate(stats.last10DaysStats, totalValue);

    return [
      {
        title: 'Total mails',
        value: stats.totalUploaded,
        percent: 100,
        trend: recentActivityRate,
        color: '#3b82f6'
      },
      {
        title: 'Sent',
        value: stats.sent,
        percent: (Number(stats.sent || 0) / safeTotal) * 100,
        trend: sentRate,
        color: '#ef4444'
      },
      {
        title: 'Pending',
        value: stats.pending,
        percent: (Number(stats.pending || 0) / safeTotal) * 100,
        trend: pendingRate,
        color: '#7c3aed'
      },
      {
        title: 'Failed',
        value: stats.failed,
        percent: (Number(stats.failed || 0) / safeTotal) * 100,
        trend: failedRate ? -failedRate : 0,
        color: '#f59e0b'
      }
    ];
  }, [stats.totalUploaded, stats.sent, stats.pending, stats.failed, stats.last10DaysStats]);
}
