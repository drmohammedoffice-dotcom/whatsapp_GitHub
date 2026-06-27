import { redirect } from 'next/navigation';
import { defaultInboxHref } from '@/lib/channels';

export default function InboxIndexPage() {
  redirect(defaultInboxHref);
}
