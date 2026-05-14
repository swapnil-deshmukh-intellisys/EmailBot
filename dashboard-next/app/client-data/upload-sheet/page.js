'use client';

import AppLayout from '@/app/components/layout/AppLayout';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';
import ClientDataSectionNav from '@/app/client-data/components/ClientDataSectionNav';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

export default function UploadSheetPage() {
  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      <div className="client-data-page">
        <ClientDataSectionNav />

        <section className="ui-page-section client-data-upload-sheet-page">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Upload Sheet</h2>
              <p className="ui-page-section-description">
                Upload Excel or CSV, preview repeated clients, and save unique client records.
              </p>
            </div>
          </div>

          <div className="client-data-upload-sheet-card">
            <div>
              <strong>Start a new client sheet upload</strong>
              <p>Choose your file, review duplicate matches, edit rows if needed, then save the cleaned sheet.</p>
            </div>
            <UploadSheetWorkflow buttonClassName="client-data-section-switcher-button client-data-upload-sheet-button active" />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
