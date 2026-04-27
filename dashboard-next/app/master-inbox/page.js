import { WorkspaceSectionPage, workspacePageConfigs } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';

export default function MasterInboxPage({ searchParams }) {
  const sender = String(searchParams?.sender || '').trim();
  const subject = String(searchParams?.subject || '').trim();
  const preview = String(searchParams?.preview || '').trim();
  const time = String(searchParams?.time || '').trim();

  return (
    <WorkspaceSectionPage
      {...workspacePageConfigs['master-inbox']}
      highlightTitle={subject || 'Selected mail'}
      highlightSender={sender ? `${sender} sent you a mail` : ''}
      highlightPreview={preview || 'Open this thread to view the full message.'}
      highlightMeta={time ? `Received ${time}` : 'Selected from dashboard notification'}
      highlightAction="Open Shared Inbox"
    />
  );
}
