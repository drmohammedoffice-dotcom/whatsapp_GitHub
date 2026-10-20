import { Injectable } from '@nestjs/common';
import { WebhookEventStatus, WebhookProvider } from '@watsapp/database';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: {
    teamId?: string;
    provider: WebhookProvider;
    eventType: string;
    externalId?: string;
    payload: Prisma.InputJsonValue;
  }) {
    return this.prisma.integrationWebhookEvent.create({
      data: {
        teamId: input.teamId,
        provider: input.provider,
        eventType: input.eventType,
        externalId: input.externalId,
        payload: input.payload,
        status: WebhookEventStatus.PENDING,
      },
    });
  }

  async markProcessed(id: string, error?: string) {
    return this.prisma.integrationWebhookEvent.update({
      where: { id },
      data: {
        status: error ? WebhookEventStatus.FAILED : WebhookEventStatus.PROCESSED,
        error: error ?? null,
        processedAt: new Date(),
      },
    });
  }

  list(teamId: string, limit = 100) {
    return this.prisma.integrationWebhookEvent.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
