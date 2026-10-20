import { Injectable, Logger } from '@nestjs/common';
import { WebhookEventStatus, WebhookProvider } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Persists every raw Meta webhook payload for auditing, replay, and debugging.
 * Messenger and Instagram Graph API events share the same webhook endpoint.
 */
@Injectable()
export class MetaWebhookLogService {
  private readonly logger = new Logger(MetaWebhookLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logIncomingEvent(body: Record<string, unknown>, signature?: string) {
    const object = String(body.object ?? 'unknown');
    const entries = (body.entry as Array<Record<string, unknown>> | undefined) ?? [];
    const externalId = entries[0]?.id ? String(entries[0].id) : null;
    const eventType = this.resolveEventType(object, entries);

    try {
      await this.prisma.integrationWebhookEvent.create({
        data: {
          provider: WebhookProvider.META,
          eventType,
          externalId,
          payload: {
            ...body,
            _meta: {
              signaturePresent: Boolean(signature),
              receivedAt: new Date().toISOString(),
            },
          } as never,
          status: WebhookEventStatus.PENDING,
        },
      });
      this.logger.log(
        `[Meta webhook logged] object=${object} eventType=${eventType} externalId=${externalId ?? 'n/a'} entries=${entries.length}`,
      );
    } catch (err) {
      this.logger.error(
        `[Meta webhook log FAILED] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private resolveEventType(object: string, entries: Array<Record<string, unknown>>) {
    const entry = entries[0];
    if (!entry) return `meta.${object}`;

    if (object === 'whatsapp_business_account') {
      const change = (entry.changes as Array<{ field?: string }> | undefined)?.[0];
      return change?.field ? `whatsapp.${change.field}` : 'whatsapp.webhook';
    }

    if (Array.isArray(entry.messaging) && entry.messaging.length) return 'meta.messaging';
    if (Array.isArray(entry.changes) && entry.changes.length) {
      const field = (entry.changes[0] as { field?: string })?.field;
      return field ? `meta.${field}` : 'meta.changes';
    }
    if (Array.isArray(entry.standby) && entry.standby.length) return 'meta.standby';
    return `meta.${object}`;
  }
}
