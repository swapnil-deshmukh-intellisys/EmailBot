import WorkspaceSectionPage from '../components/WorkspaceSectionPage';
import { workspacePageConfigs } from '../components/workspacePageConfigs';

export default function WarmUpPage() {
  return <WorkspaceSectionPage {...workspacePageConfigs['email-warmup']} />;
}
