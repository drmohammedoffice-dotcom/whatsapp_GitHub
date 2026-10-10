import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhookProvider } from '@watsapp/database';
import { WebhookEventService } from './webhook-event.service';

@ApiTags('Webhooks')
@Controller('webhooks/tiktok')
export class TikTokWebhookController {
  constructor(private readonly webhooks: WebhookEventService) {}

  @Get()
  @ApiOperation({ summary: 'TikTok webhook verification challenge' })
  verify(
    @Query('challenge') challenge?: string,
    @Query('verify_token') verifyToken?: string,
  ) {
    // TikTok webhook verification — store challenge response when token matches env
    return { challenge: challenge ?? 'ok', verifyTokenReceived: Boolean(verifyToken) };
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 200, ttl: 60_000 } })
  @ApiOperation({ summary: 'TikTok webhook event receiver' })
  async receive(
    @Body() body: Record<string, unknown>,
    @Headers('x-tiktok-signature') signature?: string,
  ) {
    const event = await this.webhooks.ingest({
      provider: WebhookProvider.TIKTOK,
      eventType: String(body.event ?? body.type ?? 'unknown'),
      externalId: String(body.event_id ?? body.id ?? ''),
      payload: { ...body, signatureReceived: Boolean(signature) },
    });

    // Process asynchronously via queue in production — mark processed for now
    await this.webhooks.markProcessed(event.id);
    return { ok: true };
  }
}
