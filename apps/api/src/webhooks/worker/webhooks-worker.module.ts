import { Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { WebhookProcessor } from '../webhook.processor';
import { WebhooksService } from '../webhooks.service';

@Module({
  imports: [QueuesModule],
  providers: [WebhooksService, WebhookProcessor],
})
export class WebhooksWorkerModule {}
