import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function DraftTemplatesPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['draft-templates']} />;
}
