import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CampaignRedirectService } from './campaign-redirect.service';

@ApiTags('Campaign Redirects')
@Controller('go')
export class CampaignGoController {
  constructor(private readonly redirect: CampaignRedirectService) {}

  @Get(':campaignSlug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dynamic campaign → WhatsApp redirect with analytics' })
  async go(
    @Param('campaignSlug') campaignSlug: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.redirect.handleRedirect(campaignSlug, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers.referer,
      query: {
        utm_source: query.utm_source,
        utm_medium: query.utm_medium,
        utm_campaign: query.utm_campaign,
        utm_term: query.utm_term,
        utm_content: query.utm_content,
        country: query.country,
        ref: query.ref,
      },
    });
    return res.redirect(302, result.redirectUrl);
  }
}
