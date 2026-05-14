'use client';

import { usePathname, useRouter } from 'next/navigation';

const CLIENT_DATA_SECTIONS = [
  { label: 'Client List', href: '/client-data/client-list' },
  { label: 'Uploaded Files', href: '/client-data/uploaded-files' },
  { label: 'Upload Sheet', href: '/client-data/upload-sheet' }
];

export default function ClientDataSectionNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <section className="client-data-page-header">
      <div className="client-data-page-header-copy">
        <h1>Client Data</h1>
        <p>Upload, manage, and review client files and records.</p>
      </div>
      <div className="client-data-section-switcher" aria-label="Client data pages">
        {CLIENT_DATA_SECTIONS.map((section) => (
          <button
            key={section.href}
            type="button"
            className={`client-data-section-switcher-button ${pathname === section.href ? 'active' : ''}`}
            onClick={() => router.push(section.href)}
          >
            {section.label === 'Upload Sheet' ? (
              <span className="client-data-upload-sheet-icon" aria-hidden="true">&uarr;</span>
            ) : null}
            <span>{section.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
