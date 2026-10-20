import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  Res,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../common/principal';
import { MetaOAuthService } from './meta-oauth.service';
import { MetaService } from './meta.service';
import { MetaOAuthStartDto } from './dto/meta.dto';

type MetaAuthLoginResponse = {
  authUrl: string;
  state: string;
};

/**
 * Production Meta webhook + OAuth routes (no /api/v1 prefix).
 *
 * Register in Meta Developer Console:
 * - Webhook URL: {API_PUBLIC_URL}/api/webhooks/meta
 * - OAuth redirect: {API_PUBLIC_URL}/api/auth/meta/callback
 */
@ApiTags('Meta Public')
@Controller()
export class MetaPublicController {
  private readonly logger = new Logger(MetaPublicController.name);

  constructor(
    private readonly meta: MetaService,
    private readonly oauth: MetaOAuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Meta webhook verification (GET).
   * Meta sends hub.mode=subscribe, hub.verify_token, and hub.challenge during setup.
   * Must return hub.challenge as plain text when verify token matches META_VERIFY_TOKEN.
   */
  @Get('api/webhooks/meta')
  @ApiOperation({ summary: 'Meta webhook verification handshake' })
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    try {
      const verified = this.meta.verifyWebhookChallenge(mode, token, challenge);
      return res.status(200).type('text/plain').send(verified);
    } catch {
      return res.status(403).type('text/plain').send('Forbidden');
    }
  }

  /**
   * Meta webhook receiver (POST).
   * Accepts Messenger, Instagram, and WhatsApp Cloud API events.
   * Logs every payload, returns HTTP 200 immediately, processes asynchronously.
   */
  @Post('api/webhooks/meta')
  @ApiOperation({ summary: 'Receive Meta Messenger / Instagram webhook events' })
  receiveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Res() res: Response,
  ) {
    this.meta.acceptWebhookEvent(body, signature, req.rawBody);
    return res.status(200).send('EVENT_RECEIVED');
  }

  /**
   * Public Facebook JS SDK config (app id only — no secrets).
   * Used by the web app to call FB.init() per Meta Developer Console setup.
   */
  @Get('api/meta/sdk-config')
  @ApiOperation({ summary: 'Facebook JS SDK bootstrap config' })
  getSdkConfig() {
    return this.meta.getSdkConfig();
  }

  /**
   * Start Facebook Login OAuth for Messenger page permissions.
   * Linked Instagram Business accounts are discovered via Graph API after OAuth.
   * Requires authenticated user; returns Facebook authorization URL.
   */
  @Post('api/auth/meta/login')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start Meta (Facebook) OAuth — returns authorization URL' })
  startOAuth(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: MetaOAuthStartDto = {},
  ): Promise<MetaAuthLoginResponse> {
    this.logger.log(
      `[Meta OAuth login] userId=${principal.userId} teamId=${principal.teamId} target=${body.target ?? 'both'}`,
    );
    return this.oauth.startPublicConnect(principal.teamId, principal.userId!, body.target).then((result) => {
      if (!result.authUrl) {
        this.logger.error('[Meta OAuth login] authUrl missing in startPublicConnect response');
      } else {
        this.logger.log(`[Meta OAuth login] authUrl generated (${result.authUrl.length} chars)`);
      }
      return result;
    });
  }

  /**
   * Meta OAuth callback (GET).
   * Facebook redirects here with ?code=&state= after user approves permissions.
   * Exchanges code for tokens, saves page/Instagram credentials, redirects to page picker.
   */
  @Get('api/auth/meta/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Meta OAuth callback (public)' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `[Meta OAuth callback] code=${code ? 'present' : 'missing'} state=${state ? 'present' : 'missing'} error=${error ?? 'none'}`,
    );
    try {
      if (error || errorDescription) {
        throw new BadRequestException(errorDescription ?? error ?? 'Meta authorization denied');
      }
      const redirectUrl = await this.oauth.handlePublicCallback(code, state);
      this.logger.log(`[Meta OAuth callback] success — redirecting to ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (err) {
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
      const message =
        err instanceof BadRequestException
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : 'Meta authorization failed';
      this.logger.warn(`[Meta OAuth callback] failed: ${message}`);
      return res.redirect(
        `${webUrl}/settings/integrations?error=${encodeURIComponent(message.slice(0, 300))}`,
      );
    }
  }
}
