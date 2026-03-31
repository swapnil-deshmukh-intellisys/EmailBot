import React from 'react';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/Table';
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
        <Card className="ui-panel-card">
          <CardHeader className="ui-panel-card-header">
            <CardTitle>
              {selectedStatsRange
                ? `${summaryRanges.find((range) => range.value === selectedStatsRange)?.label || 'Selected Range'} Data`
                : selectedStatsDate
                  ? `${selectedStatsDate} Data`
                  : 'Total Day Mail Count'}
            </CardTitle>
            <Button variant="secondary" onClick={onCloseDayCounts}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="ui-panel-card-content">
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mail Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dailyMailCounts || []).map((item) => (
                    <TableRow key={item.date}>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

export default React.memo(DashboardStats);
