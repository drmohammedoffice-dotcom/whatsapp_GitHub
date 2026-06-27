'use client';

import { notFound, useParams } from 'next/navigation';
import { InboxView } from '@/components/inbox/inbox-view';
import { channelBySlug, type ChannelSlug } from '@/lib/channels';

export default function ChannelInboxPage() {
  const params = useParams();
  const slug = params.channel as string;
  const channel = channelBySlug[slug as ChannelSlug];
  if (!channel) notFound();
  return <InboxView channel={channel} />;
}
