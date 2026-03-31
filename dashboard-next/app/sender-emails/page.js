import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function SenderEmailsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['sender-emails']} />;
}
