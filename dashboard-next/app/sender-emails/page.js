import { WorkspaceSectionPage, workspacePageConfigs } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';

export const dynamic = 'force-dynamic';

export default function SenderEmailsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['sender-emails']} />;
}
