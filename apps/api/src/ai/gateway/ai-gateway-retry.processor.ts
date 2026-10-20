import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../queues/queues.constants';
import type { AiGatewayRetryJob } from './ai-gateway.service';

/**
 * Observability worker for gateway retry markers.
 * Actual chat retries run inside AiGatewayService (ordered, in-process)
 * so auto-reply never drops a message when AI is enabled.
 */
@Processor(QUEUES.AI_GATEWAY_RETRY)
export class AiGatewayRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(AiGatewayRetryProcessor.name);

  async process(job: Job<AiGatewayRetryJob>) {
    this.logger.log(
      `Retry Scheduled processed jobId=${job.id} correlationId=${job.data.request.correlationId ?? 'n/a'} attempt=${job.data.attempt}`,
    );
  }
}
