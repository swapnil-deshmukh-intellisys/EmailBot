import { redirect } from 'next/navigation';

export default function UploadSheetPage() {
  redirect('/client-data/client-list?tab=upload');
}
