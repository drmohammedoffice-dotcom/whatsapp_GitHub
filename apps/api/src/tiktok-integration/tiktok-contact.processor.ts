import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import {
  TikTokContactJob,
  TikTokIntegrationTrackingService,
} from './tiktok-integration-tracking.service';
import { TikTokLifecycleEventsService } from './tiktok-lifecycle-events.service';
import { TIKTOK_CONTACT_EVENT } from './tiktok-integration.constants';

@Processor(QUEUES.TIKTOK_CONTACT)
export class TikTokContactProcessor extends WorkerHost {
  private readonly logger = new Logger(TikTokContactProcessor.name);

  constructor(
    private readonly tracking: TikTokIntegrationTrackingService,
    private readonly lifecycle: TikTokLifecycleEventsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<TikTokContactJob>) {
    try {
      const row = await this.prisma.tikTokIntegrationConversion.findUnique({
        where: { id: job.data.conversionId },
        select: { eventName: true },
      });
      if (!row) return;
      if (row.eventName === TIKTOK_CONTACT_EVENT) {
        await this.tracking.dispatchContactEvent(job.data.conversionId);
      } else {
        await this.lifecycle.dispatchLifecycleEvent(job.data.conversionId);
      }
    } catch (error) {
      this.logger.error(
        `TikTok event retry failed conversion=${job.data.conversionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
