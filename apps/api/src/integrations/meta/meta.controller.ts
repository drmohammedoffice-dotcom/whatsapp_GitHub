import { Controller, Get, Post, Body, Query, Headers, Res, UseGuards, BadRequestException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../../common/principal';
import { MetaConnectDto, MetaDisconnectDto, MetaOAuthCompleteDto, InstagramLoginConnectDto } from './dto/meta.dto';
import { MetaOAuthService } from './meta-oauth.service';
import { MetaService } from './meta.service';

@ApiTags('Meta Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('meta')
export class MetaController {
  constructor(
    private readonly meta: MetaService,
    private readonly oauth: MetaOAuthService,
  ) {}

  /** Team Meta integration status (OAuth + webhook configuration flags). */
  @Get('status')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  status() {
    return this.meta.getStatus();
  }

  /**
   * Start Meta OAuth (legacy /api/v1 path).
   * Prefer POST /api/auth/meta/login for new integrations.
   */
  @Post('oauth/start')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Start Meta (Facebook/Instagram) OAuth flow' })
  oauthStart(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.startConnect(principal.teamId, principal.userId!);
  }

  @Post('oauth/reconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Re-run Meta OAuth to refresh permissions' })
  oauthReconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.oauth.reconnect(principal.teamId, principal.userId!);
  }

  @Get('oauth/pages')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'List Facebook Pages available after OAuth' })
  oauthPages(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('session') sessionId: string,
  ) {
    return this.oauth.getSessionPages(principal.teamId, sessionId);
  }

  @Post('oauth/complete')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Connect selected Facebook Pages and Instagram accounts' })
  oauthComplete(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MetaOAuthCompleteDto) {
    return this.oauth.completeConnect(principal.teamId, principal.userId!, dto);
  }

  /** @deprecated Use POST /meta/oauth/start */
  @Post('connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MetaConnectDto) {
    return this.meta.connect(principal.teamId, dto);
  }

  @Post('instagram-login/connect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Connect Instagram via Instagram Login API token + subscribe webhooks' })
  connectInstagramLogin(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: InstagramLoginConnectDto,
  ) {
    return this.meta.connectInstagramLogin(principal.teamId, dto.accessToken);
  }

  @Post('instagram-login/:channelId/resubscribe-webhooks')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Re-subscribe Instagram Login webhooks (comments + messages)' })
  resubscribeInstagramLogin(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('channelId') channelId: string,
  ) {
    return this.meta.resubscribeInstagramLoginWebhooks(principal.teamId, channelId);
  }

  @Post('disconnect')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: MetaDisconnectDto) {
    return this.meta.disconnect(principal.teamId, dto.channelId);
  }

  @Post('resubscribe-webhooks')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Re-subscribe all Meta pages to Messenger webhooks' })
  resubscribeWebhooks(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.meta.resubscribeWebhooks(principal.teamId);
  }

  @Post('sync-messages')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Pull Messenger and Instagram conversations from Meta Graph API into inbox' })
  syncMessages(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.meta.syncInboxMessages(principal.teamId);
  }

  @Post('sync-comments')
  @RequirePermissions(Permission.INBOX_READ)
  @ApiOperation({ summary: 'Pull Instagram post comments from Meta Graph API into inbox' })
  syncComments(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.meta.syncPostComments(principal.teamId);
  }

  @Get('instagram-access')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Diagnose Instagram DM permissions for connected channels' })
  inspectInstagramAccess(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.meta.inspectInstagramAccess(principal.teamId);
  }
}

@ApiTags('Meta Webhooks')
@Controller('meta/webhook')
export class MetaWebhookController {
  constructor(private readonly meta: MetaService) {}

  /** @deprecated Prefer GET /api/webhooks/meta for Meta Developer Console webhook URL */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.meta.verifyWebhook(mode, token, challenge);
  }

  /** @deprecated Prefer POST /api/webhooks/meta — logs events and returns HTTP 200 immediately */
  @Post()
  receive(@Body() body: Record<string, unknown>, @Headers('x-hub-signature-256') signature?: string) {
    this.meta.acceptWebhookEvent(body, signature);
    return { ok: true };
  }
}

@ApiTags('Meta OAuth')
@Controller('meta/oauth')
export class MetaOAuthCallbackController {
  constructor(
    private readonly oauth: MetaOAuthService,
    private readonly config: ConfigService,
  ) {}

  /** @deprecated Prefer GET /api/auth/meta/callback for Facebook Login redirect URI */
  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Meta OAuth callback (public)' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
    try {
      if (error || errorDescription) {
        throw new BadRequestException(errorDescription ?? error ?? 'Meta authorization denied');
      }
      const redirectUrl = await this.oauth.handleCallback(code, state);
      return res.redirect(redirectUrl);
    } catch (err) {
      const message =
        err instanceof BadRequestException
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : 'Meta authorization failed';
      return res.redirect(
        `${webUrl}/settings/integrations?error=${encodeURIComponent(message.slice(0, 300))}`,
      );
    }
  }
}
