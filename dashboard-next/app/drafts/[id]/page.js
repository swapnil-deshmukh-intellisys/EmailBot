import DraftDetailClientPage from './DraftDetailClientPage';

export const dynamic = 'force-dynamic';

export default function DraftDetailPage({ params }) {
  return <DraftDetailClientPage draftId={params.id} />;
}
