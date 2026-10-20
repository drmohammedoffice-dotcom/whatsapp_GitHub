import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from './queues.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.WEBHOOKS },
      { name: QUEUES.OUTBOUND_MESSAGES },
      { name: QUEUES.AI_INBOUND },
      { name: QUEUES.AI_GATEWAY_RETRY },
      { name: QUEUES.TIKTOK_SYNC },
      { name: QUEUES.TIKTOK_CONTACT },
      { name: QUEUES.APPOINTMENT_REMINDERS },
      { name: QUEUES.CREATIVE_PIPELINE },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
