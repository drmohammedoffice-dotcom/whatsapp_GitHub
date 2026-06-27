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
  @ApiOperation({ summary: 'Start TikTok OAuth 2.0 connection flow' })
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
  @ApiOperation({ summary: 'Reconnect TikTok account (re-run OAuth)' })
  reconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.reconnect(principal.teamId, principal.userId!);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TIKTOK_VIEW)
  @ApiOperation({ summary: 'Get TikTok connection status and dashboard summary' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tiktok.getStatus(principal.teamId);
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

  @Get('oauth/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'TikTok OAuth callback (public)',
    description: 'Handles TikTok OAuth redirect, stores encrypted tokens, then redirects to the web dashboard.',
  })
  async oauthCallback(
    @Query('auth_code') authCode: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.oauth.handleCallback(authCode, state);
    return res.redirect(redirectUrl);
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
  async track(
    @Param('workspaceId') workspaceId: string,
    @Param('campaignId') campaignId: string,
    @Query('ttclid') ttclid: string | undefined,
    @Query('source') source: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const team = await this.tracking.resolveTeam(workspaceId);
    const { click } = await this.tracking.handleClick({
      teamId: team.id,
      campaignId,
      ttclid,
      source: source ?? 'tiktok',
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
      referrer: (req.headers.referer as string) ?? null,
      landingUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    });
    const redirectUrl = await this.tracking.buildWhatsAppRedirectUrl(team.id, click.clickToken, click.campaignId);
    return res.redirect(redirectUrl);
  }
}
