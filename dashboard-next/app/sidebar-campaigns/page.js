import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function SidebarCampaignsPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs.campaigns} />;
}
