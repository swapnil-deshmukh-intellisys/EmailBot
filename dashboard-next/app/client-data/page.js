'use client';

import { AppLayout, PageContainer } from '@/app/components/layout';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageSection } from '@/app/components/ui';

const clientRows = [
  { name: 'Akshay Patel', company: 'ABC Tech', city: 'Pune', status: 'Verified', source: 'Imported CSV' },
  { name: 'Riya Sharma', company: 'ScaleOps', city: 'Bengaluru', status: 'Needs Review', source: 'Manual Entry' },
  { name: 'Milan Shah', company: 'Northstar SaaS', city: 'Mumbai', status: 'Verified', source: 'CRM Sync' },
  { name: 'Neha Joshi', company: 'Marketify', city: 'Ahmedabad', status: 'Missing Email', source: 'Imported XLSX' }
];

const sourceCards = [
  { label: 'Total Clients', value: '2,450' },
  { label: 'Active Lists', value: '18' },
  { label: 'Verified Contacts', value: '2,380' },
  { label: 'Pending Review', value: '70' }
];

const badgeToneMap = {
  Verified: 'success',
  'Needs Review': 'warning',
  'Missing Email': 'danger'
};

export default function ClientDataPage() {
  return (
    <AppLayout
      topbarProps={{
        title: 'Client Data',
        subtitle: 'Upload, manage, and review client files and records.',
        actions: (
          <>
            <Button variant="secondary">Create Sheet</Button>
            <Button>Upload File</Button>
          </>
        )
      }}
    >
      <PageContainer>
        <PageSection
          title="Overview"
          description="Track uploaded files, source health, and current client records."
        >
          <div className="client-data-stats">
            {sourceCards.map((card) => (
              <Card key={card.label} className="client-data-stat-card">
                <CardContent>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageSection>

        <PageSection
          title="Client Workspace"
          description="Keep imported lists, client records, and validation status in one place before campaigns go live."
          actions={(
            <>
              <Button variant="secondary">Import List</Button>
              <Button>Create Client Group</Button>
            </>
          )}
        >
          <div className="client-data-grid">
            <Card className="client-data-panel client-data-panel-large">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Client Directory</CardTitle>
                  <CardDescription>Latest contacts across uploaded and synced sources.</CardDescription>
                </div>
                <Button variant="ghost" size="sm">View All</Button>
              </CardHeader>

              <CardContent>
                <div className="client-data-table">
                  <div className="client-data-table-head">
                    <span>Name</span>
                    <span>Company</span>
                    <span>City</span>
                    <span>Status</span>
                    <span>Source</span>
                  </div>
                  {clientRows.map((row) => (
                    <div key={`${row.name}-${row.company}`} className="client-data-table-row">
                      <span>{row.name}</span>
                      <span>{row.company}</span>
                      <span>{row.city}</span>
                      <span>
                        <Badge variant={badgeToneMap[row.status] || 'default'}>
                          {row.status}
                        </Badge>
                      </span>
                      <span>{row.source}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Source Health</CardTitle>
                  <CardDescription>Quick view of how clean your sources are.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-health-list">
                  <div>
                    <strong>Imported CSV</strong>
                    <span>82% complete</span>
                  </div>
                  <div>
                    <strong>CRM Sync</strong>
                    <span>96% complete</span>
                  </div>
                  <div>
                    <strong>Manual Lists</strong>
                    <span>68% complete</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>What changed in your client data today.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-activity-list">
                  <article>
                    <strong>New list imported</strong>
                    <p>SaaS founders India list added with 320 contacts.</p>
                  </article>
                  <article>
                    <strong>Validation completed</strong>
                    <p>70 missing values flagged for manual review.</p>
                  </article>
                  <article>
                    <strong>Client group updated</strong>
                    <p>Enterprise prospects folder synced from CRM.</p>
                  </article>
                </div>
              </CardContent>
            </Card>
          </div>
        </PageSection>
      </PageContainer>
    </AppLayout>
  );
}
