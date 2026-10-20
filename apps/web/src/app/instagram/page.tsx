'use client';

import { Suspense } from 'react';
import { channelBySlug } from '@/lib/channels';
import { PlanGate } from '@/components/billing/plan-gate';
import { ChannelConnectPage } from '@/components/channels/channel-connect-page';
import { LoadingBlock } from '@/components/shared/loading-block';

function InstagramConnectContent() {
  return (
    <PlanGate feature="instagram">
      <ChannelConnectPage
        channel={channelBySlug.instagram}
        kind="meta"
        metaProvider="META_INSTAGRAM"
      />
    </PlanGate>
  );
}

export default function InstagramPage() {
  return (
    <Suspense fallback={<LoadingBlock className="mt-6" />}>
      <InstagramConnectContent />
    </Suspense>
  );
}
