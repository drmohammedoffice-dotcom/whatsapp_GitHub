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

@Processor(QUEUES.AI_INBOUND)
export class AiInboundProcessor extends WorkerHost {
  private readonly logger = new Logger(AiInboundProcessor.name);

  constructor(private readonly orchestrator: AiOrchestratorService) {
    super();
  }

  async process(job: Job<AiInboundJob>) {
    try {
      await this.orchestrator.handleInbound(job.data);
    } catch (error) {
      this.logger.error(`AI inbound job failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
