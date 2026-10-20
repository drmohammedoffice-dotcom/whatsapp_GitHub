import { Controller, Header, HttpCode, Logger, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { VoiceAiCallService } from './voice-ai-call.service';
import { formParams, verifyTwilioSignature } from './voice-ai.util';

@SkipThrottle()
@Controller('api/webhooks/twilio')
export class VoiceAiWebhookController {
  private readonly logger = new Logger(VoiceAiWebhookController.name);

  constructor(
    private readonly calls: VoiceAiCallService,
    private readonly config: ConfigService,
  ) {}

  @Post('voice')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async incoming(@Req() req: Request, @Res() res: Response) {
    const params = this.assertSignature(req);
    this.logger.log(JSON.stringify({ event: 'CALL_CONNECTED', callSid: params.CallSid }));
    const xml = await this.calls.startIncoming({
      callSid: params.CallSid,
      from: params.From,
      to: params.To,
    });
    return res.type('text/xml').send(xml);
  }

  @Post('gather')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  async gather(@Req() req: Request, @Res() res: Response) {
    const params = this.assertSignature(req);
    const xml = await this.calls.handleGather({
      callSid: params.CallSid,
      speech: params.SpeechResult || params.UnstableSpeechResult || '',
    });
    return res.type('text/xml').send(xml);
  }

  @Post('status')
  @HttpCode(200)
  async status(@Req() req: Request) {
    const params = this.assertSignature(req);
    await this.calls.handleStatus({
      callSid: params.CallSid,
      status: params.CallStatus || params.CallStatusEvent || '',
      duration: params.CallDuration || params.RecordingDuration,
      recordingUrl: params.RecordingUrl,
      cost: params.CallPrice || params.Price,
    });
    return { ok: true };
  }

  private assertSignature(req: Request) {
    const params = formParams(req.body);
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN')?.trim() || '';
    const skip = this.config.get<string>('VOICE_TWILIO_SKIP_SIGNATURE') === 'true';
    if (!token && skip) return params;
    const publicUrl = (this.config.get<string>('API_PUBLIC_URL') || '').replace(/\/$/, '');
    const path = req.originalUrl?.split('?')[0] || req.url;
    const url = `${publicUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const signature = String(req.headers['x-twilio-signature'] || '');
    if (!verifyTwilioSignature({ authToken: token, url, params, signature })) {
      this.logger.warn(JSON.stringify({ event: 'VOICE_PROVIDER_ERROR', reason: 'invalid_signature' }));
      throw new UnauthorizedException('Invalid Twilio signature');
    }
    return params;
  }
}
