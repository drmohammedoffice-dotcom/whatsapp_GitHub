'use client';

import { channelBySlug } from '@/lib/channels';
import { ChannelConnectPage } from '@/components/channels/channel-connect-page';

export default function MessengerPage() {
  return (
    <ChannelConnectPage
      channel={channelBySlug.messenger}
      kind="meta"
      metaProvider="META_MESSENGER"
    />
  );
}
