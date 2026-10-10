import { BadRequestException, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../common/principal';
import { TikTokLoginService } from './tiktok-login.service';

type TikTokLoginStartResponse = {
  authUrl: string;
  state: string;
  scope: string;
  redirectUri: string;
};

/**
 * TikTok Login Kit OAuth (v2).
 * Public paths (no /api/v1 prefix): /api/auth/tiktok/*
 */
@ApiTags('TikTok Login Kit')
@Controller('api/auth/tiktok')
export class TikTokLoginKitController {
  constructor(
    private readonly loginKit: TikTokLoginService,
    private readonly config: ConfigService,
  ) {}

  @Get('login')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start TikTok Login Kit — returns full authorization URL (no redirect)' })
  login(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<TikTokLoginStartResponse> {
    return this.loginKit.startLogin(principal.userId!, principal.teamId);
  }

  @Post('login')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start TikTok Login Kit — returns full authorization URL (no redirect)' })
  startJson(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<TikTokLoginStartResponse> {
    return this.loginKit.startLogin(principal.userId!, principal.teamId);
  }

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'TikTok Login Kit OAuth callback' })
  async callback(
    @Req() req: Request,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') query[key] = value;
      else if (Array.isArray(value)) query[key] = value.map(String).join(',');
    }
    try {
      const redirectUrl = await this.loginKit.handleCallback(
        code,
        state,
        error ?? errorDescription,
        { query, url: req.originalUrl },
      );
      return res.redirect(redirectUrl);
    } catch (err) {
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
      const message =
        err instanceof BadRequestException
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : 'TikTok login failed';
      const safe = encodeURIComponent(message.slice(0, 300));
      return res.redirect(`${webUrl}/tiktok?error=${safe}`);
    }
  }
}

@ApiTags('TikTok Login Kit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/tiktok-login')
export class TikTokLoginKitStatusController {
  constructor(private readonly loginKit: TikTokLoginService) {}

  @Get()
  @ApiOperation({ summary: 'Get connected TikTok Login Kit account for current user' })
  status(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.loginKit.getAccount(principal.userId!);
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect TikTok Login Kit account' })
  disconnect(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.loginKit.disconnect(principal.userId!);
  }
}
