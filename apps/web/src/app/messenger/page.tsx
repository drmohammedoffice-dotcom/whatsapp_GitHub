'use client';

import { channelBySlug } from '@/lib/channels';
import { PlanGate } from '@/components/billing/plan-gate';
import { ChannelConnectPage } from '@/components/channels/channel-connect-page';

export default function MessengerPage() {
  return (
    <PlanGate feature="facebook">
      <ChannelConnectPage
        channel={channelBySlug.messenger}
        kind="meta"
        metaProvider="META_MESSENGER"
      />
    </PlanGate>
  );
}
