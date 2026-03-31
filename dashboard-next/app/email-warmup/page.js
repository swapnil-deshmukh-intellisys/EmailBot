import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function EmailWarmupPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['email-warmup']} />;
}
