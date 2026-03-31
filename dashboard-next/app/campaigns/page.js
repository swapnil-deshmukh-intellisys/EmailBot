import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function CampaignsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs.campaigns} />;
}
