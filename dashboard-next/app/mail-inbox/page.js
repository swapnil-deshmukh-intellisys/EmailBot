import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function MailInboxPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['mail-inbox']} />;
}
