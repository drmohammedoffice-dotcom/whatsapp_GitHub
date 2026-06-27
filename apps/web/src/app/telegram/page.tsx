'use client';

import { channelBySlug } from '@/lib/channels';
import { ChannelConnectPage } from '@/components/channels/channel-connect-page';

export default function TelegramPage() {
  return (
    <ChannelConnectPage
      channel={channelBySlug.telegram}
      kind="telegram"
    />
  );
}
