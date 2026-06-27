'use client';

import { channelBySlug } from '@/lib/channels';
import { ChannelConnectPage } from '@/components/channels/channel-connect-page';

export default function InstagramPage() {
  return (
    <ChannelConnectPage
      channel={channelBySlug.instagram}
      kind="meta"
      metaProvider="META_INSTAGRAM"
    />
  );
}
