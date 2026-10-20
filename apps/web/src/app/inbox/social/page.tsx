'use client';

import { InboxView } from '@/components/inbox/inbox-view';
import { channelBySlug } from '@/lib/channels';

/** Unified inbox for Messenger, Instagram, and Telegram */
export default function SocialInboxPage() {
  return <InboxView channel={channelBySlug.messenger} socialMode />;
}
