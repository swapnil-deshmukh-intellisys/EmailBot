import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function LeadsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs.leads} />;
}
