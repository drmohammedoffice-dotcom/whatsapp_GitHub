import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookEvent } from '@watsapp/database';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.WEBHOOKS) private readonly queue: Queue,
  ) {}

  list(teamId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { teamId },
      select: { id: true, url: true, events: true, enabled: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(teamId: string, dto: CreateWebhookDto) {
    return this.prisma.webhookEndpoint.create({
      data: {
        teamId,
        url: dto.url,
        events: dto.events as WebhookEvent[],
        enabled: dto.enabled ?? true,
        secret: dto.secret ?? randomBytes(32).toString('base64url'),
      },
      select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    });
  }

  async remove(teamId: string, id: string) {
    const result = await this.prisma.webhookEndpoint.deleteMany({ where: { id, teamId } });
    if (!result.count) throw new NotFoundException('Webhook endpoint not found');
  }

  async enqueue(teamId: string, event: WebhookEvent, payload: unknown) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({ where: { teamId, enabled: true, events: { has: event } } });
    for (const endpoint of endpoints) {
      const delivery = await this.prisma.webhookDelivery.create({ data: { webhookId: endpoint.id, event, payload: payload as object } });
      await this.queue.add('deliver', { deliveryId: delivery.id }, { attempts: 5, backoff: { type: 'exponential', delay: 2_000 } });
    }
  }

  signingSecret() {
    return this.config.getOrThrow<string>('WEBHOOK_SIGNING_SECRET');
  }
}
