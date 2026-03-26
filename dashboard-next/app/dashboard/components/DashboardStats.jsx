import React from 'react';
import { FancyStatCard } from './DashboardUiBits';

function DashboardStats({
  isSearchMatch,
  fancyStats,
  showDayCounts,
  selectedStatsRange,
  selectedStatsDate,
  summaryRanges,
  dailyMailCounts,
  onCloseDayCounts
}) {
  return (
    <>
      <section className={`grid stats-grid ${isSearchMatch('summary') ? 'dashboard-search-match' : ''}`}>
        {fancyStats.map((item) => (
          <FancyStatCard
            key={item.title}
            title={item.title}
            value={item.value}
            percent={item.percent}
            trend={item.trend}
            color={item.color}
          />
        ))}
      </section>
      {showDayCounts ? (
        <section className="card grid">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              {selectedStatsRange
                ? `${summaryRanges.find((range) => range.value === selectedStatsRange)?.label || 'Selected Range'} Data`
                : selectedStatsDate
                  ? `${selectedStatsDate} Data`
                  : 'Total Day Mail Count'}
            </h3>
            <button className="button secondary" type="button" onClick={onCloseDayCounts}>
              Close
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mail Count</th>
                </tr>
              </thead>
              <tbody>
                {(dailyMailCounts || []).map((item) => (
                  <tr key={item.date}>
                    <td>{item.date}</td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

export default React.memo(DashboardStats);
