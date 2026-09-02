import { BadRequestException, Body, Controller, Headers, HttpCode, Logger, Post, RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { WaylService } from './wayl.service';

@Controller('billing/webhooks')
export class BillingWebhooksController {
  private readonly logger = new Logger(BillingWebhooksController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly wayl: WaylService,
  ) {}

  @Post('wayl')
  @HttpCode(200)
  async handleWaylWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wayl-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing x-wayl-signature-256 header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    // Verify HMAC signature using the raw body bytes
    const valid = this.wayl.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Wayl webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = this.wayl.parseWebhookPayload(body);
    return this.billing.handleWaylWebhook(payload);
  }
}