import { Injectable } from '@nestjs/common';
import { WebhookEvent } from '@watsapp/database';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Injectable()
export class WhatsAppWebhookService {
  constructor(private readonly webhooks: WebhooksService) {}

  incomingMessage(teamId: string, payload: unknown) {
    return this.webhooks.enqueue(teamId, WebhookEvent.INCOMING_MESSAGE, payload);
  }

  deliveryStatus(teamId: string, payload: unknown) {
    return this.webhooks.enqueue(teamId, WebhookEvent.DELIVERY_STATUS, payload);
  }

  readStatus(teamId: string, payload: unknown) {
    return this.webhooks.enqueue(teamId, WebhookEvent.READ_STATUS, payload);
  }

  presence(teamId: string, payload: unknown) {
    return this.webhooks.enqueue(teamId, WebhookEvent.PRESENCE, payload);
  }
}
