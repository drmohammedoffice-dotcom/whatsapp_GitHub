import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import { WebhooksService } from './webhooks.service';

@Injectable()
@Processor(QUEUES.WEBHOOKS)
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService, private readonly webhooks: WebhooksService) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: job.data.deliveryId }, include: { webhook: true } });
    if (!delivery) return;

    const payload = JSON.stringify({ id: delivery.id, event: delivery.event, occurredAt: delivery.createdAt, data: delivery.payload });
    const signature = createHmac('sha256', delivery.webhook.secret || this.webhooks.signingSecret()).update(payload).digest('hex');

    try {
      await axios.post(delivery.webhook.url, payload, {
        headers: { 'content-type': 'application/json', 'x-watsapp-signature': `sha256=${signature}` },
        timeout: 10_000,
      });
      await this.prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: 'DELIVERED', deliveredAt: new Date(), attempts: { increment: 1 } } });
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'FAILED', attempts: { increment: 1 }, lastError: error instanceof Error ? error.message : 'Unknown webhook error' },
      });
      throw error;
    }
  }
}
