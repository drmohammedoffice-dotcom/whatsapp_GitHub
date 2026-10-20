import { Controller, Headers, Post, Req, Logger } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { WebmailResendService } from './webmail-resend.service';

@ApiExcludeController()
@Controller('webhooks/resend')
export class WebmailInboundController {
  private readonly logger = new Logger(WebmailInboundController.name);

  constructor(private readonly resendMail: WebmailResendService) {}

  @Post('inbound')
  async inbound(
    @Req() req: { rawBody?: Buffer; body?: unknown },
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const raw =
      req.rawBody ??
      Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));

    let event: {
      type?: string;
      data?: Record<string, unknown>;
    };
    try {
      event = this.resendMail.verifyWebhook(raw, headers) as typeof event;
    } catch (err) {
      this.logger.warn(`Resend webhook verify failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ok: false, error: 'invalid_signature' };
    }

    this.logger.log(`Resend webhook type=${event.type ?? 'unknown'}`);
    const result = await this.resendMail.handleInboundEvent(event as never);
    return { ok: true, ...result };
  }
}
