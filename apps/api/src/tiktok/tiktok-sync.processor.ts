import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queues.constants';
import { TikTokSyncService } from './tiktok-sync.service';

export type TikTokSyncJob = { teamId: string };

@Processor(QUEUES.TIKTOK_SYNC)
export class TikTokSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TikTokSyncProcessor.name);

  constructor(private readonly sync: TikTokSyncService) {
    super();
  }

  async process(job: Job<TikTokSyncJob>) {
    try {
      await this.sync.syncAccount(job.data.teamId);
    } catch (error) {
      this.logger.error(
        `TikTok sync failed for team ${job.data.teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
