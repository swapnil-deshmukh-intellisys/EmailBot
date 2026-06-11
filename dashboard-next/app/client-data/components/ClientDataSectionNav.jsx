'use client';

import { usePathname, useRouter } from 'next/navigation';

const CLIENT_DATA_SECTIONS = [
  { key: 'upload', label: 'Upload File', href: '/client-data/client-list?tab=upload', icon: 'ti-upload' },
  { key: 'customize', label: 'Customize List', href: '/client-data/client-list?tab=customize', icon: 'ti-adjustments-horizontal' },
  { key: 'bin', label: 'Bin Storage', href: '/client-data/client-list?tab=bin', icon: 'ti-trash' },
  { key: 'client-list', label: 'Client List', href: '/client-data/client-list', icon: 'ti-list' }
];

export default function ClientDataSectionNav({ activeTab = '', onTabChange = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleSections = CLIENT_DATA_SECTIONS;

  return (
    <section className="client-data-page-header">
      <div className="client-data-page-header-copy">
        <h1>Client Data</h1>
      </div>
      <div className="client-data-section-switcher" aria-label="Client data pages">
        {visibleSections.map((section) => (
          <button
            key={section.key}
            type="button"
            className={`client-data-section-switcher-button ${(activeTab ? activeTab === section.key : pathname === section.href) ? 'active' : ''}`}
            onClick={() => {
              if (onTabChange) {
                onTabChange(section.key);
                return;
              }
              router.push(section.href);
            }}
          >
            <i className={`ti ${section.icon}`} aria-hidden="true" />
            <span>{section.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
