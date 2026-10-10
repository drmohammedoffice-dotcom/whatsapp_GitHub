import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentPrincipal } from '../../common/current-principal.decorator';
import { AuthenticatedPrincipal } from '../../common/principal';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';

type TikTokMarketingLoginResponse = {
  authUrl: string;
  state: string;
  redirectUri: string;
};

class TikTokMarketingLoginDto {
  @IsOptional()
  @IsString()
  returnTo?: string;

  /** window.location.origin from the browser that started OAuth */
  @IsOptional()
  @IsString()
  returnOrigin?: string;
}

function peekReturnOriginFromState(state: string | undefined): string | undefined {
  try {
    const parts = String(state ?? '').split('.');
    if (parts.length < 2) return undefined;
    const json = Buffer.from(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as { returnOrigin?: string };
    return typeof parsed.returnOrigin === 'string' ? parsed.returnOrigin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * TikTok Marketing API OAuth (Business / Ads).
 * Public paths (no /api/v1 prefix): /api/auth/tiktok-business/*
 */
@ApiTags('TikTok Marketing OAuth')
@Controller('api/auth/tiktok-business')
export class TikTokMarketingOAuthController {
  constructor(private readonly marketingOAuth: TikTokMarketingOAuthService) {}

  @Post('login')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start TikTok Marketing API OAuth — returns authorization URL' })
  login(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TikTokMarketingLoginDto,
  ): Promise<TikTokMarketingLoginResponse> {
    return this.marketingOAuth.startLogin(principal.userId!, principal.teamId, {
      returnTo: body.returnTo,
      returnOrigin: body.returnOrigin,
    });
  }

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'TikTok Marketing API OAuth callback' })
  async callback(
    @Req() req: Request,
    @Query('auth_code') authCode: string,
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

    const resolvedAuthCode = authCode || code;

    try {
      const redirectUrl = await this.marketingOAuth.handleCallback(
        resolvedAuthCode,
        state,
        error ?? errorDescription,
        { query, url: req.originalUrl },
      );
      return res.redirect(redirectUrl);
    } catch (err) {
      const webUrl = this.marketingOAuth.resolveWebBase(peekReturnOriginFromState(state));
      const message =
        err instanceof BadRequestException
          ? String(err.message)
          : err instanceof Error
            ? err.message
            : 'TikTok Business authorization failed';
      const safe = encodeURIComponent(message.slice(0, 300));
      return res.redirect(`${webUrl}/tiktok?error=${safe}`);
    }
  }
}
