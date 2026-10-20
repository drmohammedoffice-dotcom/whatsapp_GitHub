import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queues.constants';
import { AiOrchestratorService } from './ai-orchestrator.service';

export type AiInboundJob = {
  teamId: string;
  conversationId: string;
  messageId: string;
  messageText?: string | null;
  isNewConversation?: boolean;
};

@Processor(QUEUES.AI_INBOUND, {
  lockDuration: 600_000,
  stalledInterval: 120_000,
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      const delays = [2_000, 5_000, 10_000, 30_000];
      return delays[Math.min(Math.max(attemptsMade - 1, 0), delays.length - 1)]!;
    },
  },
})
export class AiInboundProcessor extends WorkerHost {
  private readonly logger = new Logger(AiInboundProcessor.name);

  constructor(private readonly orchestrator: AiOrchestratorService) {
    super();
  }

  async process(job: Job<AiInboundJob>) {
    this.logger.log(
      `[AI] Job started id=${job.id} conversationId=${job.data.conversationId} teamId=${job.data.teamId} messageId=${job.data.messageId}`,
    );
    try {
      await this.orchestrator.handleInbound(job.data);
      this.logger.log(`[AI] Job completed id=${job.id} conversationId=${job.data.conversationId}`);
    } catch (error) {
      this.logger.error(
        `[AI] Job failed id=${job.id} conversationId=${job.data.conversationId} teamId=${job.data.teamId} Reason=${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
