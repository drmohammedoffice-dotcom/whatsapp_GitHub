import { Controller, Get, Post, Body, Query, Param, Res, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Permission } from '@watsapp/database';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../common/current-principal.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthenticatedPrincipal } from '../common/principal';
import {
  TikTokConnectDto,
  TikTokCreateCampaignDto,
  TikTokAppCredentialsDto,
  TikTokCustomEventDto,
  TikTokDisconnectDto,
  TikTokEventsQueryDto,
  TikTokUpdateSettingsDto,
} from './dto/tiktok.dto';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { TikTokService } from './tiktok.service';
import { TikTokTrackingService } from './tiktok-tracking.service';

@ApiTags('TikTok')
@Controller('tiktok')
export class TikTokController {
  constructor(
    private readonly tiktok: TikTokService,
    private readonly oauth: TikTokOAuthService,
    private readonly tracking: TikTokTrackingService,
  ) {}

  @Post('connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({
    summary: 'Deprecated — use Login Kit (POST /api/auth/tiktok/login)',
    description: 'TikTok Marketing API OAuth was removed. Connect via Settings → Integrations.',
  })
  connect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokConnectDto) {
    return this.tiktok.connect(principal.teamId, principal.userId!, dto.advertiserId);
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Disconnect TikTok account' })
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokDisconnectDto) {
    return this.tiktok.disconnect(principal.teamId, principal.userId!, dto.reason);
  }

  @Post('reconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({
    summary: 'Deprecated — use Login Kit (POST /api/auth/tiktok/login)',
    description: 'TikTok Marketing API OAuth was removed. Reconnect via Settings → Integrations.',
  })
  reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.reconnect(principal.teamId, principal.userId!);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Get TikTok connection status and dashboard summary' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getStatus(principal.teamId, principal.userId ?? undefined);
  }

  @Get('business')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Get TikTok advertisers and business centers' })
  business(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getBusiness(principal.teamId);
  }

  @Get('campaigns')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'List local TikTok tracking campaigns' })
  campaigns(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getCampaigns(principal.teamId);
  }

  @Post('campaigns')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Create a local tracking campaign' })
  createCampaign(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokCreateCampaignDto) {
    return this.tiktok.createCampaign(principal.teamId, dto);
  }

  @Get('events')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'List TikTok events' })
  events(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: TikTokEventsQueryDto) {
    return this.tiktok.getEvents(principal.teamId, query);
  }

  @Get('events/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Get TikTok event analytics summary' })
  eventStats(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getEventStats(principal.teamId);
  }

  @Post('events/custom')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Record a custom TikTok event' })
  customEvent(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokCustomEventDto) {
    return this.tiktok.createCustomEvent(principal.teamId, dto);
  }

  @Post('settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Update TikTok integration settings' })
  settings(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokUpdateSettingsDto) {
    return this.tiktok.updateSettings(principal.teamId, dto);
  }

  @Get('app-credentials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Get TikTok Developer app credentials (masked)' })
  appCredentials(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getAppCredentials(principal.teamId);
  }

  @Get('app-credentials/default-redirect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Suggested OAuth redirect URI for TikTok Developer portal' })
  defaultRedirect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getDefaultRedirectUri();
  }

  @Post('app-credentials')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Save TikTok Developer app credentials for this workspace' })
  saveAppCredentials(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: TikTokAppCredentialsDto) {
    return this.tiktok.saveAppCredentials(principal.teamId, dto);
  }

  @Post('app-credentials/clear')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Remove workspace TikTok app credentials (falls back to server .env if set)' })
  clearAppCredentials(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.clearAppCredentials(principal.teamId);
  }

  @Get('logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Get TikTok integration logs' })
  logs(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getLogs(principal.teamId);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_MANAGE)
  @ApiOperation({ summary: 'Sync TikTok advertisers and business centers' })
  sync(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.syncAccount(principal.teamId);
  }

  @Get('tracking-link/:campaignId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Generate tracking link for a campaign' })
  trackingLink(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('campaignId') campaignId: string) {
    return this.tiktok.getTrackingLink(principal.teamId, campaignId);
  }
}

@ApiTags('TikTok Tracking')
@Controller('t')
export class TikTokTrackingController {
  constructor(private readonly tracking: TikTokTrackingService) {}

  @Get(':workspaceId/:campaignId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Public tracking link redirect',
    description: 'Records click/landing events then redirects to WhatsApp with a tracking reference.',
  })
  track(
    @Param('workspaceId') workspaceId: string,
    @Param('campaignId') campaignId: string,
    @Query('ttclid') ttclid: string | undefined,
    @Query('source') source: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return redirectTikTokClick(this.tracking, workspaceId, campaignId, ttclid, source, req, res);
  }
}

@ApiTags('TikTok Tracking')
@Controller()
export class TikTokTrackingAliasController {
  constructor(private readonly tracking: TikTokTrackingService) {}

  @Get('t/t/:workspaceId/:campaignId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public tracking link used inside TikTok ads' })
  track(
    @Param('workspaceId') workspaceId: string,
    @Param('campaignId') campaignId: string,
    @Query('ttclid') ttclid: string | undefined,
    @Query('source') source: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return redirectTikTokClick(this.tracking, workspaceId, campaignId, ttclid, source, req, res);
  }
}

async function redirectTikTokClick(
  tracking: TikTokTrackingService,
  workspaceId: string,
  campaignId: string,
  ttclid: string | undefined,
  source: string | undefined,
  req: Request,
  res: Response,
) {
  const team = await tracking.resolveTeam(workspaceId);
  const { click } = await tracking.handleClick({
    teamId: team.id,
    campaignId,
    ttclid,
    source: source ?? 'tiktok',
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: req.ip ?? null,
    referrer: (req.headers.referer as string) ?? null,
    landingUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
  });
  const redirectUrl = await tracking.buildWhatsAppRedirectUrl(team.id, click.clickToken, click.campaignId);
  return res.redirect(redirectUrl);
}
