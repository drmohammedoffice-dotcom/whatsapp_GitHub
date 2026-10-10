'use client';

import { channelBySlug } from '@/lib/channels';
import { PlanGate } from '@/components/billing/plan-gate';
import { ChannelConnectPage } from '@/components/channels/telegram-connect-page';

export default function TelegramPage() {
  return (
    <PlanGate feature="telegram">
      <ChannelConnectPage channel={channelBySlug.telegram} kind="telegram" />
    </PlanGate>
  );
}
