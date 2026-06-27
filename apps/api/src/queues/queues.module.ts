import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from './queues.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.WEBHOOKS }, { name: QUEUES.OUTBOUND_MESSAGES }, { name: QUEUES.AI_INBOUND }, { name: QUEUES.TIKTOK_SYNC })],
  exports: [BullModule],
})
export class QueuesModule {}
