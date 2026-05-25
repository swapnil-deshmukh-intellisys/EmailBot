import UserProfilePage from '../page';

const allowedSections = new Set(['overview', 'settings', 'notifications', 'billing', 'security']);

export default function UserProfileSectionPage({ params }) {
  const section = allowedSections.has(params?.section) ? params.section : 'profile';
  return <UserProfilePage initialSection={section} />;
}
