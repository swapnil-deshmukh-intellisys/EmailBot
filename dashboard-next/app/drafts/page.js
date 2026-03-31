import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function DraftsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs.drafts} />;
}
