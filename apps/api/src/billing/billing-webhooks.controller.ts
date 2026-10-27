import { Body, Controller, ForbiddenException, Headers, HttpCode, Logger, Post, RawBodyRequest, Req } from '@nestjs/common';
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
    const rawBody = req.rawBody;
    const payload = this.wayl.parseWebhookPayload(body);

    let signatureVerified = false;
    if (signature && rawBody) {
      const valid = this.wayl.verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        this.logger.warn('Wayl webhook signature verification failed');
        throw new ForbiddenException('Invalid webhook signature');
      }
      signatureVerified = true;
    } else {
      this.logger.warn('Wayl webhook missing signature — confirming payment via Wayl API only');
    }

    return this.billing.handleWaylWebhook(payload, signatureVerified);
  }
}