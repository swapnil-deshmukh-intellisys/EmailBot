import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function MasterInboxPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['master-inbox']} />;
}
