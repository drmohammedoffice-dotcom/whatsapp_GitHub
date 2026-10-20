import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../api/src/queues/queues.constants';
import { CreativeStudioService, type CreativePipelineJob } from '../../api/src/creative-studio/creative-studio.service';

@Processor(QUEUES.CREATIVE_PIPELINE, {
  lockDuration: 900_000,
  stalledInterval: 120_000,
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      const delays = [2_000, 5_000, 10_000, 30_000];
      return delays[Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1)]!;
    },
  },
})
export class CreativeStudioProcessor extends WorkerHost {
  private readonly logger = new Logger(CreativeStudioProcessor.name);

  constructor(private readonly studio: CreativeStudioService) {
    super();
  }

  async process(job: Job<CreativePipelineJob>) {
    this.logger.log(
      JSON.stringify({
        event: 'CREATIVE_PIPELINE_START',
        jobId: job.data.generationJobId,
        teamId: job.data.teamId,
      }),
    );
    await this.studio.processQueuedJob(job.data.generationJobId);
  }
}
